npm run compile &&
    npm run full-deploy-local && 
    npx hardhat upgrade-feed --network localhost &&
    npx hardhat setup-mock-env --network localhost