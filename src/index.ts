import { Client, Intents, TextChannel } from 'discord.js';
import { config } from 'dotenv';
import { ApiPromise, WsProvider } from '@polkadot/api';
import { formatBalance } from '@polkadot/util';
import cron from 'cron';
import BigNumber from 'bignumber.js';
import { addNewWalletTotals, getYesterdayWalletTotals } from './db';

config();

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});

const {
  BIG_TIME_CONTROLLER_SIG_EXTENSION,
  BIG_TIME,
  BOOSH_TESTING_SERVER,
  CFG_STAKING_REPORTER_CHANNEL,
  JP_WALLET,
  MULTISIG_BIG_TIME_CONTROLLER,
  ONE_YEAR_CONTROLLER_EXTENSION,
  ONE_YEAR_PROXY,
  THREE_YEAR_CONTROLLER_EXTENSION,
  THREE_YEAR_PROXY,
} = process.env;

const personalWallets = [
  BIG_TIME_CONTROLLER_SIG_EXTENSION,
  JP_WALLET,
  ONE_YEAR_CONTROLLER_EXTENSION,
  ONE_YEAR_PROXY,
  THREE_YEAR_CONTROLLER_EXTENSION,
  THREE_YEAR_PROXY,
];

const bigTimeWallets = [BIG_TIME, MULTISIG_BIG_TIME_CONTROLLER];

const wsProvider = new WsProvider('wss://fullnode.centrifuge.io');

const formatCFG = value =>
  formatBalance(value, { decimals: 18, forceUnit: '-', withSi: false });

const getWalletTotal = (free, reserved) => {
  const trimmedFree = free.replaceAll(',', '');
  const trimmedReserved = reserved.replaceAll(',', '');

  return parseFloat(trimmedFree) + parseFloat(trimmedReserved);
};

const getTotal = async (api, wallets) => {
  let total = 0;

  for (let i = 0; i < wallets.length; i += 1) {
    const walletAddress = wallets[i];

    const account = await api.query.system.account(walletAddress);

    const free = formatCFG(account.data.free);
    const reserved = formatCFG(account.data.reserved);
    const walletTotal = getWalletTotal(free, reserved);

    total += walletTotal;
  }

  return total;
};

client.once('ready', () => {
  const scheduledMessage = new cron.CronJob(
    '00 19 * * *',
    async () => {
      const api = await ApiPromise.create({ provider: wsProvider });

      const {
        bigTimeWalletsTotal: yesterdayBigTimeWalletsTotal,
        personalWalletsTotal: yesterdayPersonalWalletsTotal,
      } = await getYesterdayWalletTotals();

      const personalWalletsTotal = await getTotal(api, personalWallets);

      const bigTimeWalletsTotal = await getTotal(api, bigTimeWallets);

      await addNewWalletTotals(personalWalletsTotal, bigTimeWalletsTotal);

      const guild = client.guilds.cache.get(BOOSH_TESTING_SERVER);
      const channel = guild.channels.cache.get(CFG_STAKING_REPORTER_CHANNEL); // cfg-staking-reporter

      const personalWalletsGain = new BigNumber(personalWalletsTotal).minus(
        new BigNumber(yesterdayPersonalWalletsTotal),
      );

      const bigTimeWalletsGain = new BigNumber(bigTimeWalletsTotal).minus(
        new BigNumber(yesterdayBigTimeWalletsTotal),
      );

      (channel as TextChannel).send(`
Personal Wallets Total: ${new BigNumber(
        personalWalletsTotal,
      ).toFormat()} **+${personalWalletsGain.toFormat()}**
Big Time Wallets Total: ${new BigNumber(
        bigTimeWalletsTotal,
      ).toFormat()} **+${bigTimeWalletsGain.toFormat()}**
Total: ${new BigNumber(personalWalletsTotal)
        .plus(new BigNumber(bigTimeWalletsTotal))
        .toFormat()} **+${personalWalletsGain
        .plus(bigTimeWalletsGain)
        .toFormat()}**`);
    },
    null,
    true,
    'America/Chicago',
  );

  scheduledMessage.start();
});

client.login(process.env.DISCORD_BOT_TOKEN);
