/*
  置換: subgraph.template.yaml の ${NETWORK}, ${ADDRESS}, ${START_BLOCK} を networks.json から選択して subgraph.yaml を生成
*/
const fs = require("fs");
const path = require("path");

const network = process.env.NETWORK || "localhost";
const networks = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "networks.json"), "utf8")
);
const t = fs.readFileSync(
  path.join(__dirname, "..", "subgraph.template.yaml"),
  "utf8"
);

if (!networks[network] || !networks[network].Staking) {
  console.error(`No config for network: ${network}`);
  process.exit(1);
}

const { address, startBlock } = networks[network].Staking;

const out = t
  .replace(/\$\{NETWORK\}/g, network)
  .replace(/\$\{ADDRESS\}/g, address)
  .replace(/\$\{START_BLOCK\}/g, String(startBlock));

fs.writeFileSync(path.join(__dirname, "..", "subgraph.yaml"), out);
console.log(`Generated subgraph.yaml for ${network}`);
