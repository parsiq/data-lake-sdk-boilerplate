import * as sdk from '@parsiq/data-lake-sdk';
import { TsunamiApiClient, ChainId } from '@parsiq/tsunami-client';
import { TsunamiFilter, TsunamiEvent, DatalakeTsunamiApiClient } from '@parsiq/tsunami-client-sdk-http';
import { Interface } from '@ethersproject/abi';

// Import your ABIs here, in a format suitable for decoding using @ethersproject/abi.
import cnsRegistryAbi from './cns-registry.json';

// Put your Tsunami API key here.
const TSUNAMI_API_KEY = '';
// This is the chain ID for Ethereum mainnet Tsunami API. Change it if you want to work with a different net.
const TSUNAMI_API_NET = ChainId.ETH_MAINNET;

// CNS Registry contract address, replace or drop if you intend to monitor something else.
const CONTRACT_ADDRESS = '0xD1E5b0FF1287aA9f9A268759062E4Ab08b9Dacbe';

// topic_0 hashes of our events of interest.
const EVENT_NEW_URI_TOPIC_0 = '0xc5beef08f693b11c316c0c8394a377a0033c9cf701b8cd8afd79cecef60c3952';
const EVENT_TRANSFER_TOPIC_0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Contract deployment block is used as a starting point for the datalake.
const CONTRACT_DEPLOYMENT_BLOCK_NUMBER = 9_082_251;

// This defines the layout of the type-safe K-V storage.
type DatalakeStorageLayout = {
    '': any,
    domains: { uri: string },
    ownership: { owner: string },
};

type DatalakeStorageMetaLayout = {
    '': {},
    domains: {},
    ownership: {},
};

// Types for decoded events follow.
type NewUriEvent = {
    tokenId: {
        _hex: string,
    },
    uri: string,
};

type TransferEvent = {
    from: string,
    to: string,
    tokenId: {
        _hex: string,
    },
}

class Datalake extends sdk.AbstractMultiStorageDataLakeBase<DatalakeStorageLayout, DatalakeStorageMetaLayout, TsunamiFilter, TsunamiEvent> {
    private cnsRegistryDecoder: Interface;

    // Construct ABI decoders here.
    constructor() {
        super();
        this.cnsRegistryDecoder = new Interface(cnsRegistryAbi);
    }

    public override getProperties(): sdk.DataLakeProperties {
        return {
            id: 'DATALAKE-TEMPLATE',
            initialBlockNumber: CONTRACT_DEPLOYMENT_BLOCK_NUMBER,
        };
    }

    // This method generates the filter used to retrieve events from Tsunami. Filter may change from block to block.
    public async genTsunamiFilterForBlock(block: sdk.Block & sdk.DataLakeRunnerState, isNewBlock: boolean): Promise<TsunamiFilter> {
        return {
            contract: [CONTRACT_ADDRESS],
            topic_0: [EVENT_NEW_URI_TOPIC_0, EVENT_TRANSFER_TOPIC_0],
        };
    }

    // Main event handler.
    public async processTsunamiEvent(event: TsunamiEvent & sdk.TimecodedEvent & sdk.DataLakeRunnerState): Promise<void | TsunamiFilter> {
        switch (event.topic_0) {
            case EVENT_NEW_URI_TOPIC_0:
                await this.processNewUriEvent(event);
                break;
            case EVENT_TRANSFER_TOPIC_0:
                await this.processTransferEvent(event);
                break;
        }
    }

    private async processNewUriEvent(event: TsunamiEvent): Promise<void> {
        // Decodes the event...
        const fragment = this.cnsRegistryDecoder.getEvent(event.topic_0!);
        const decoded = this.cnsRegistryDecoder.decodeEventLog(fragment, event.log_data!, [
            event.topic_0!,
            event.topic_1!
        ]) as unknown as NewUriEvent;
        // ...then writes to reogranization-aware K-V storage.
        await this.set('domains', decoded.tokenId._hex, { uri: decoded.uri });
    }

    private async processTransferEvent(event: TsunamiEvent): Promise<void> {
        if (event.op_code !== 'LOG4') {
            return;
        }
        const fragment = this.cnsRegistryDecoder.getEvent(event.topic_0!);
        const decoded = this.cnsRegistryDecoder.decodeEventLog(fragment, event.log_data!, [
            event.topic_0!,
            event.topic_1!,
            event.topic_2!,
            event.topic_3!
        ]) as unknown as TransferEvent;
        await this.set('ownership', decoded.tokenId._hex, { owner: decoded.to });
    }

    // The following event handlers should be no-ops under most circumstances.
    public async processEndOfBlockEvent(event: sdk.Block & sdk.DataLakeRunnerState): Promise<void> {}
    public async processBeforeDropBlockEvent(event: sdk.DropBlockData & sdk.DataLakeRunnerState): Promise<void> {}
    public async processAfterDropBlockEvent(event: sdk.DropBlockData & sdk.DataLakeRunnerState): Promise<void> {}
}

export const run = async (): Promise<void> => {
    const logger = new sdk.ConsoleLogger();
    logger.log('DEBUG', 'Initializing datalake...');
    const datalake = new Datalake();
    logger.log('DEBUG', 'Initializing Tsunami API...');
    const tsunami = new TsunamiApiClient(TSUNAMI_API_KEY, TSUNAMI_API_NET);
    logger.log('DEBUG', 'Initializing SDK Tsunami client...');
    const tsunamiSdk = new DatalakeTsunamiApiClient(tsunami);
    logger.log('DEBUG', 'Initializing runner...');
    const runner = new sdk.MultiStorageDataLakeRunner({
        storageConfig: {
            '': { meta: {} },
            'domains': { meta: {} },
            'ownership': { meta: {} },
        },
        datalake: datalake,
        tsunami: tsunamiSdk,
        log: logger,
    });
    logger.log('DEBUG', 'Running...');
    await runner.run();
}
