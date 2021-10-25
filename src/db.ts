import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

config();

type WalletTotals = {
  _id?: string;
  bigTimeWalletsTotal: string;
  personalWalletsTotal: string;
};

const uri = process.env.MONGO_DB_URI;

const mongoDBClient = new MongoClient(uri);

export async function getYesterdayWalletTotals(): Promise<WalletTotals> {
  try {
    await mongoDBClient.connect();
    const database = mongoDBClient.db('cfg-staking');
    const totals = database.collection<WalletTotals>('totalslee');

    const walletTotals = await totals
      .find({})
      .sort({ _id: -1 })
      .limit(1)
      .project<WalletTotals>({ _id: 0 })
      .toArray();

    if (walletTotals.length) {
      return walletTotals[0];
    }

    return {
      personalWalletsTotal: '0',
      bigTimeWalletsTotal: '0',
    };
  } catch (error) {
    console.log(error);
  }
}

export async function addNewWalletTotals(
  personalWalletsTotal: number,
  bigTimeWalletsTotal: number,
) {
  try {
    await mongoDBClient.connect();
    const database = mongoDBClient.db('cfg-staking');
    const totals = database.collection('totals');
    return totals.insertOne({ personalWalletsTotal, bigTimeWalletsTotal });
  } catch (error) {
    console.log(error);
  }
}
