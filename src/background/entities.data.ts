import type { Chain } from '@/shared/chains';
import type { EntityLabel } from './entities';

// Seed entity-label dataset built from publicly documented addresses:
// - Tornado Cash pool + router contracts (mixer)
// - Major exchange hot wallets (exchange)
// - Well-known bridges (bridge)
// Production ships a much larger lazy-loaded dataset (~50k) from public tagpacks.
// All keys are lowercased for EVM.
export const ENTITY_DATA: Record<Chain, Record<string, EntityLabel>> = {
  eth: {
    // ---- Tornado Cash (mixer) ----
    '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc': { label: 'Tornado Cash 0.1 ETH', type: 'mixer' },
    '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936': { label: 'Tornado Cash 1 ETH', type: 'mixer' },
    '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf': { label: 'Tornado Cash 10 ETH', type: 'mixer' },
    '0xa160cdab225685da1d56aa342ad8841c3b53f291': { label: 'Tornado Cash 100 ETH', type: 'mixer' },
    '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b': { label: 'Tornado Cash Router', type: 'mixer' },
    '0xd96f2b1c14db8458374d9aca76e26c3d18364307': { label: 'Tornado Cash 100 USDC', type: 'mixer' },
    '0x169ad27a470d064dede56a2d3ff727986b15d52b': { label: 'Tornado Cash 1000 USDC', type: 'mixer' },
    '0x22aaa7720ddd5388a3c0a3333430953c68f1849b': { label: 'Tornado Cash 5000 DAI', type: 'mixer' },
    '0xba214c1c1928a32bffe790263e38b4af9bfcd659': { label: 'Tornado Cash 100000 DAI', type: 'mixer' },
    // ---- Exchanges ----
    '0x28c6c06298d514db089934071355e5743bf21d60': { label: 'Binance 14', type: 'exchange' },
    '0x21a31ee1afc51d94c2efccaa2092ad1028285549': { label: 'Binance 15', type: 'exchange' },
    '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': { label: 'Binance 16', type: 'exchange' },
    '0x56eddb7aa87536c09ccc2793473599fd21a8b17f': { label: 'Binance 17', type: 'exchange' },
    '0x9696f59e4d72e237be84ffd425dcad154bf96976': { label: 'Binance 18', type: 'exchange' },
    '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': { label: 'Coinbase 1', type: 'exchange' },
    '0x503828976d22510aad0201ac7ec88293211d23da': { label: 'Coinbase 2', type: 'exchange' },
    '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740': { label: 'Coinbase 3', type: 'exchange' },
    '0x2910543af39aba0cd09dbb2d50200b3e800a63d2': { label: 'Kraken 1', type: 'exchange' },
    '0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13': { label: 'Kraken 2', type: 'exchange' },
    '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b': { label: 'OKX 1', type: 'exchange' },
    '0x236f9f97e0e62388479bf9e5ba4889e46b0273c3': { label: 'OKX 2', type: 'exchange' },
    '0x876eabf441b2ee5b5b0554fd502a8e0600950cfa': { label: 'Bitfinex 1', type: 'exchange' },
    // ---- Bridges ----
    '0x3ee18b2214aff97000d974cf647e7c347e8fa585': { label: 'Wormhole Bridge', type: 'bridge' },
    '0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf': { label: 'Polygon (PoS) Bridge', type: 'bridge' },
    '0x8315177ab297ba92a06054ce80a67ed4dbd7ed3a': { label: 'Arbitrum Bridge', type: 'bridge' },
    '0xa0c68c638235ee32657e8f720a23cec1bfc77c77': { label: 'Polygon Plasma Bridge', type: 'bridge' },
  },
  tron: {
    // TRON exchange hot wallets (base58)
    TWd4WrZ9wn84f5x1hZhL4DHvk738ns5jwb: { label: 'Binance (TRON)', type: 'exchange' },
    TMuA6YqfCeX8EhbfYEg5y7S4DqzSJireY9: { label: 'Binance Hot (TRON)', type: 'exchange' },
    TEkxrqUrGVQ3Mgb46NMcXvmL7XZuo1u5eS: { label: 'Poloniex (TRON)', type: 'exchange' },
  },
  btc: {},
  sol: {},
};
