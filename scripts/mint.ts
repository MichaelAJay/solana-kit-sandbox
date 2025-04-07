import * as solKit from '@solana/kit';
import * as solSystem from '@solana-program/system';
import * as solToken from '@solana-program/token';
import { pipe } from '@solana/functional';
import { payerPrivateKey } from '../config/secrets';

const config = {
    env: 'dev',
    url: 'api.devnet.solana.com',
    feePayerPrivateKey: payerPrivateKey,
    decimals: 6,
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
        decimals
    } = config;
    const rpc = solKit.createSolanaRpc(`https://${url}`);
    const rpcSubscriptions = solKit.createSolanaRpcSubscriptions(`wss://${url}`);
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    // Create fee payer
    const feePayer = await (env === 'dev' ? solKit.createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode(feePayerPrivateKey)) : solKit.generateKeyPairSigner());
    // Try to fund
    const mintAuthority = feePayer;
    const mint = await solKit.generateKeyPairSigner();
    const mintSpace = solToken.getMintSize();
    const rentLamports = await rpc.getMinimumBalanceForRentExemption(mintSpace as unknown as bigint).send();

    // Specify instructions
    const createAccountInstruction = solSystem.getCreateAccountInstruction({
        payer: feePayer,
        newAccount: mint,
        lamports: rentLamports,
        space: mintSpace,
        programAddress: solToken.TOKEN_PROGRAM_ADDRESS
    });

    const initializeMintInstruction = solToken.getInitializeMintInstruction({
        mint: mint.address,
        mintAuthority: mintAuthority.address,
        freezeAuthority: null,
        decimals
    });

    // Create transaction I guess
    const transactionMessage = pipe(
        solKit.createTransactionMessage({ version: 0 }),
        (tx) => solKit.setTransactionMessageFeePayerSigner(feePayer, tx),
        (tx) => solKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => solKit.appendTransactionMessageInstructions(
            [createAccountInstruction, initializeMintInstruction],
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
})(); 