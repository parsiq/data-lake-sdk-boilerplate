#!/bin/bash
wait-port pg:5432
node --expose-gc --optimize-for-size dist/main.js "$@"
