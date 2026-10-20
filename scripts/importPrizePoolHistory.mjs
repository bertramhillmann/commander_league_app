import fs from 'node:fs'
import mongoose from 'mongoose'

const rows = [
  ['2026-02-12', 'Thrym', 'ECL Draft Booster', 4.24],
  ['2026-02-12', 'Moritz', 'WOE Draft Booster', 4.50],
  ['2026-02-12', 'Franz', 'WOE Draft Booster', 4.50],
  ['2026-02-28', 'Birt', 'KHM Draft Booster', 3.99],
  ['2026-02-28', 'Birt', 'KHM Draft Booster', 3.99],
  ['2026-03-08', 'Robert', 'ECL Draft Booster', 4.24],
  ['2026-03-08', 'Robert', 'ECL Draft Booster', 4.24],
  ['2026-03-08', 'Robert', 'ECL Draft Booster', 4.24],
  ['2026-03-08', 'Robert', 'ECL Draft Booster', 4.24],
  ['2026-03-09', 'Thrym', 'ECL Draft Booster', 4.24],
  ['2026-03-09', 'Thrym', 'ECL Draft Booster', 4.24],
  ['2026-03-09', 'Thrym', 'ECL Draft Booster', 4.24],
  ['2026-03-15', 'Thrym', 'ECL Draft Booster', 4.24],
  ['2026-03-15', 'Thrym', 'ECL Draft Booster', 4.24],
  ['2026-03-20', 'Moritz', 'RVR Collector Booster', 64.75],
  ['2026-03-21', 'Robert', 'CMR Collector Booster', 51.49],
  ['2026-03-22', 'Franz', 'ECL Draft Booster', 4.24],
  ['2026-03-22', 'Franz', 'ECL Draft Booster', 4.24],
  ['2026-03-22', 'Franz', 'ECL Draft Booster', 4.24],
  ['2026-03-22', 'Franz', 'ECL Draft Booster', 4.24],
  ['2026-03-22', 'Franz', 'ECL Draft Booster', 4.24],
  ['2026-03-22', 'Franz', 'ECL Draft Booster', 4.24],
  ['2026-03-25', 'Birt', 'VOW Collector Booster', 19.90],
  ['2026-03-25', 'Birt', 'VOW Collector Booster', 19.90],
  ['2026-03-25', 'Birt', 'VOW Collector Booster', 19.90],
  ['2026-04-18', 'Thrym', 'Command Tower J12 #8 F', 28.00],
  ['2026-04-19', 'Birt', 'FDN Play Booster', 3.99],
  ['2026-04-19', 'Birt', 'FDN Play Booster', 3.99],
  ['2026-04-19', 'Birt', 'FDN Play Booster', 3.99],
  ['2026-04-19', 'Birt', 'FDN Play Booster', 3.99],
  ['2026-04-19', 'Birt', 'FDN Play Booster', 3.99],
  ['2026-04-19', 'Pierre', 'FDN Sammler-Booster', 49.99],
  ['2026-04-26', 'Birt', "Cathars' Crusade INR #438 F", 9.00],
  ['2026-04-26', 'Birt', 'Eldritch Evolution SLD #1414 F', 16.00],
  ['2026-04-26', 'Birt', 'Lightning Bolt SLD #1822 F', 2.99],
  ['2026-04-26', 'Birt', 'Mulldrifter SLD #1887 F', 3.70],
  ['2026-04-26', 'Birt', 'Noxious Revival SLD #1416 F', 17.50],
  ['2026-04-26', 'Birt', 'Rampant Growth SLD #1370 F', 3.49],
  ['2026-04-26', 'Robert', 'M13 Booster', 6.99],
  ['2026-04-26', 'Robert', 'M13 Booster', 6.99],
  ['2026-04-26', 'Robert', 'M14 Booster', 5.45],
  ['2026-04-26', 'Robert', 'M14 Booster', 5.45],
  ['2026-04-26', 'Robert', 'M14 Booster', 5.45],
  ['2026-04-26', 'Robert', 'M14 Booster', 5.45],
  ['2026-04-26', 'Robert', 'M14 Booster', 5.45],
  ['2026-04-27', 'Thrym', 'Path to Exile PF20 #1 F', 11.89],
  ['2026-04-27', 'Thrym', 'Rampant Growth P09 #7 NF', 4.49],
  ['2026-05-23', 'Robert', 'SOM Booster', 20.50],
  ['2026-05-23', 'Robert', 'SOM Booster', 20.50],
  ['2026-05-23', 'Robert', 'SOM Booster', 20.50],
  ['2026-05-23', 'Franz', 'TDM Collector Booster', 30.00],
  ['2026-05-23', 'Franz', 'Undercity Sewers MKM #332 F', 47.99],
  ['2026-05-31', 'Birt', 'LRW Booster', 31.99],
  ['2026-05-31', 'Birt', 'LRW Booster', 31.99],
  ['2026-05-31', 'Birt', 'LRW Booster', 31.99],
  ['2026-05-31', 'Birt', 'LRW Booster', 31.99],
  ['2026-07-12', 'Robert', 'ONE Collector Booster', 79.99],
  ['2026-07-12', 'Birt', 'Precon Merciless Rage', 47.00],
  ['2026-07-12', 'Birt', 'SNC Draft Booster', 3.00],
  ['2026-07-12', 'Birt', 'SNC Draft Booster', 3.00],
  ['2026-07-18', 'Unassigned', 'SOS Play Booster', 3.68],
  ['2026-08-25', 'Pierre', 'BLB Collector Booster', 89.90],
  ['2026-08-25', 'Birt', 'HOB Play Booster', 5.17],
  ['2026-08-25', 'Franz', 'HOB Play Booster', 5.17],
  ['2026-08-25', 'Lars', 'HOB Play Booster', 5.17],
  ['2026-08-25', 'Moritz', 'HOB Play Booster', 5.17],
  ['2026-08-25', 'Pierre', 'HOB Play Booster', 5.17],
  ['2026-08-25', 'Robert', 'HOB Play Booster', 5.17],
  ['2026-08-25', 'Thrym', 'HOB Play Booster', 5.17],
  ['2026-08-25', 'Unassigned', 'Aragorn and Arwen, Wed HOC #0028 F', 8.50],
  ['2026-09-26', 'Birt', 'Eye of Ugin SPG #0159 NF', 34.00],
]

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.trimStart().startsWith('#') && line.includes('='))
    .map((line) => {
      const splitAt = line.indexOf('=')
      return [line.slice(0, splitAt).trim(), line.slice(splitAt + 1).trim().replace(/^['"]|['"]$/g, '')]
    }),
)

if (!env.MONGODB_URI) throw new Error('MONGODB_URI is not configured')

await mongoose.connect(env.MONGODB_URI)
const collection = mongoose.connection.collection('prizepoolitems')
const result = await collection.bulkWrite(rows.map(([date, playerName, description, priceEuro], index) => ({
  updateOne: {
    filter: { sourceKey: `historical-prize-pool-2026-${String(index + 1).padStart(3, '0')}` },
    update: {
      $setOnInsert: {
        playerName,
        description,
        priceEuro,
        date: new Date(`${date}T00:00:00.000Z`),
        sourceKey: `historical-prize-pool-2026-${String(index + 1).padStart(3, '0')}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
    upsert: true,
  },
})))

console.log(JSON.stringify({
  supplied: rows.length,
  inserted: result.upsertedCount,
  alreadyPresent: rows.length - result.upsertedCount,
  suppliedValueEuro: rows.reduce((sum, row) => sum + row[3], 0).toFixed(2),
}))
await mongoose.disconnect()
