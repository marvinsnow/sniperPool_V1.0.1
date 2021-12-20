"use strict";
const env = require("./env.json");
Object.assign(process.env, env);

const ethers = require("ethers");
const purchaseToken = process.env.PURCHASE_TOKEN;

const purchaseAmount = ethers.utils.parseUnits(
  process.env.PURCHASE_AMOUNT,
  "ether"
);

const slippage = process.env.SLIPPAGE;

const wbnb = "0xae13d989dac2f0debff460ac112a837c89baa7cd"; //WBNB testnet
const busd = "0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7"; //BUSD testnet
const wbtc = "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"; //WBTC testnet
const pcs = "0x9ac64cc6e4415144c455bd8e4837fea55603e5c3"; // pancakeswap testnet

const pcsAbi = new ethers.utils.Interface(require("./pcs.json"));
// console.log("pcsAbi", pcsAbi);
const EXPECTED_PONG_BACK = 30000;
const KEEP_ALIVE_CHECK_INTERVAL = 15000;
const provider = new ethers.providers.WebSocketProvider(
  process.env.BSC_NODES_WSS
);
const signer = provider.getSigner();

// console.log("signer", signer);
const wallet = new ethers.Wallet.fromMnemonic(process.env.MNEMONIC);
const account = wallet.connect(provider);
const router = new ethers.Contract(pcs, pcsAbi, account);

const getTransaction = async () => {
  const tx = await provider.getTransaction(
    "0x785f081abc56325c56d32ead65323b776ff12aec881d00d07556c5265aeb1cfb"
  );
  const decodedInput = pcsAbi.parseTransaction({
    data: tx.data,
    value: tx.value,
  });
  console.log("decodedInput", decodedInput);
};
const startConnection = async () => {
  let pingTimeout = null;
  let keepAliveInterval = null;
  provider._websocket.on("open", () => {
    console.log("txtPool sniping has begun \n");
    keepAliveInterval = setInterval(() => {
      provider._websocket.ping();
      pingTimeout = setTimeout(() => {
        provider._websocket.terminate();
      }, EXPECTED_PONG_BACK);
    }, KEEP_ALIVE_CHECK_INTERVAL);

    provider.on("pending", async (txHash) => {
      provider.getTransaction(txHash).then(async (tx) => {
        // console.log(`pcs: ${pcs}, Tx.to: ${tx.to}, txHash: ${txHash}`);
        if (tx && tx.to) {
          console.log(`pcs: ${pcs}, Tx.to: ${tx.to}, txHash: ${txHash}`);
          if (tx.to.toLowerCase() === pcs.toLowerCase()) {
            // console.log(`pcs: ${pcs}, Tx.to: ${tx.to}, txHash: ${txHash}`);
            let re = new RegExp("^0xf305d719"); //"^0xf305d719"

            if (re.test(tx.data)) {
              const decodedInput = pcsAbi.parseTransaction({
                data: tx.data,
                value: tx.value,
              });

              console.log(
                "checking if " +
                  decodedInput.args[0] +
                  " matches " +
                  purchaseToken
              );
              if (
                purchaseToken.toLowerCase() ===
                decodedInput.args[0].toLowerCase()
              ) {
                console.log("encontrado");
                await BuyToken(txHash);
              }
            }
          }
        }
      });
    });
  });

  provider._websocket.on("close", () => {
    console.log("Websocket Closed... Reconnecting ... \n");
    clearInterval(keepAliveInterval);
    clearTimeout(pingTimeout);
    startConnection();
  });

  provider._websocket.on("error", () => {
    console.log("Websocket Error... Reconnecting ... \n");
    clearInterval(keepAliveInterval);
    clearTimeout(pingTimeout);
    startConnection();
  });
  provider._websocket.on("pong", (err) => {
    clearInterval(pingTimeout);
  });
};

const BuyToken = async (txHash) => {
  const amounts = await router.getAmountsOut(purchaseAmount, [
    wbnb,
    purchaseToken,
  ]);
  console.log("amounts", amounts);
  //   const amountOutMin = amounts[1].sub(amounts[1].div(slippage));
  //   console.log("amountOutMin", amountOutMin);
  const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
    0,
    [wbnb, purchaseToken],
    process.env.RECIPIENT,
    Date.now() + 100 * 60 * 5, //5 minutes
    {
      value: purchaseAmount,
      gasLimit: 345684, //cambiar
      gasPrice: ethers.utils.parseUnits("20", "gwei"),
    }
  );
  console.log("waiting for trx recipient");
  const recipient = await tx.wait();
  console.log("Token purchase complete");
  console.log("Associated Lp Event txHash: " + txHash);
  console.log("Associated Lp Event recipient: " + recipient.transactionHash);
  process.exit();
};

startConnection();
// getTransaction();
