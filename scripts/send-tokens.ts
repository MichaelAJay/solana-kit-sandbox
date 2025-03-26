import * as solKit from '@solana/kit';
import * as solToken from '@solana-program/token';
import { pipe } from '@solana/functional';
import { payerPrivateKey } from '../config/secrets';

const config = {
    env: 'dev',
    url: 'api.devnet.solana.com',
    feePayerPrivateKey: payerPrivateKey,
    decimals: 6,
    mintAddress: '33mppJgqTnSkumFDPUTbTUquejR7Lxyzevh5LxQpqvPF',
    sourceAtaAddress: 'BBBGCUHgh5i75rw4vhdYSe3mHHvMUbUukCEcqUYLuNJP',
    destinationAddress: '5pyaoUk8GZnS3Pfs3JUFChx7jkB5RCNS9y6jJ6bjSHoT',
    destinationAtaAddress: '2Ba5zAJRBnd4E96Ms8HQGcrn5m8qaYgPdym14RzN2ohy'
};
const bs58Encoder = solKit.getBase58Encoder();

// Self-invoking async function to allow top-level await
(async () => {
  try {
    // Setup
    const {
        env,
        url,
        feePayerPrivateKey,
        decimals,
        mintAddress,
        destinationAtaAddress,
        destinationAddress,
        sourceAtaAddress
    } = config;
    const rpc = solKit.createSolanaRpc(`https://${url}`);
    const rpcSubscriptions = solKit.createSolanaRpcSubscriptions(`wss://${url}`);
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    // Create fee payer
    const feePayer = await (env === 'dev' ? solKit.createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode(feePayerPrivateKey)) : solKit.generateKeyPairSigner());
    const mint = solKit.address(mintAddress);

    // Specify instructions
    const transferCheckedInstruction = solToken.getTransferCheckedInstruction({
        source: solKit.address(sourceAtaAddress),
        mint,
        destination: solKit.address(destinationAtaAddress),
        authority: feePayer,
        amount: 10,
        decimals
    })

    // Create transaction I guess
    const transactionMessage = pipe(
        solKit.createTransactionMessage({ version: 0 }),
        (tx) => solKit.setTransactionMessageFeePayerSigner(feePayer, tx),
        (tx) => solKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => solKit.appendTransactionMessageInstructions(
            [transferCheckedInstruction],
            tx
        )
    );
    
    const signedTransactionMessage = await solKit.signTransactionMessageWithSigners(transactionMessage);
    const sendAndConfirmTransaction = solKit.sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
    await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'confirmed' });
    const signature = solKit.getSignatureFromTransaction(signedTransactionMessage);
    console.log('Success!', signature);
  } catch (error) {
    console.error('Error minting token:', error);
  }
})()
