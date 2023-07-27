# Quick start

Before you can run anything, you must change the `TSUNAMI_API_KEY` constant in `src/datalake.ts` to your private Tsunami key.

`src/datalake.ts` implements a very simple stateful datalake monitoring the CNS Registry contract on Ethereum mainnet. The code is annotated to help you modify it for your purposes.

To build the runner image:

```
sudo docker build -t datalake-template-dev .
```

To run:

```
sudo docker-compose up
```

The datalake is currently configured to reset its state on each run. To change that behavior, as well as other configuration details, take a look at `docker-compose.yml`.

You can inspect the current state of the datalake using:

```
psql postgresql://datalake:datalake@localhost:54329/datalake
```

The `domains_entities` table contains mappings of token IDs to names, and the `ownership_entities` table tracks the current token ownership. The tables with names ending in `_mutations` contain historical data.

After running `npm install` you can find the README file for the datalake SDK at `node_modules/@parsiq/datalake-sdk/README.md`.

Have fun!
