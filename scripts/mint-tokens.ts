import * as solKit from '@solana/kit';
import * as solToken from '@solana-program/token';
import { pipe } from '@solana/functional';
import { payerPrivateKey } from '../config/secrets';

const config = {
    env: 'dev',
    url: 'api.devnet.solana.com',
    feePayerPrivateKey: payerPrivateKey,
    decimals: 6,
    mint: '33mppJgqTnSkumFDPUTbTUquejR7Lxyzevh5LxQpqvPF',
    targetAta: 'BBBGCUHgh5i75rw4vhdYSe3mHHvMUbUukCEcqUYLuNJP'
};
const bs58Encoder = solKit.getBase58Encoder();

(async () => {
    try {
        const {
            env,
            url,
            feePayerPrivateKey,
            decimals,
            mint,
            targetAta
        } = config;
        const rpc = solKit.createSolanaRpc(`https://${url}`);
        const rpcSubscriptions = solKit.createSolanaRpcSubscriptions(`wss://${url}`);
        const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

        // Create fee payer
        const feePayer = await (env === 'dev' ? solKit.createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode(feePayerPrivateKey)) : solKit.generateKeyPairSigner());
        const mintAuthority = feePayer;
        const mintAddress = solKit.address(mint);

        const mintToCheckedInstruction = solToken.getMintToCheckedInstruction({
            mint: mintAddress,
            mintAuthority: mintAuthority.address,
            amount: 1000 * 10 ** decimals,
            decimals: decimals,
            token: solKit.address(targetAta)
        });
        
        const transactionMessage = pipe(
            solKit.createTransactionMessage({ version: 0 }),
            (tx) => solKit.setTransactionMessageFeePayerSigner(feePayer, tx),
            (tx) => solKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
            (tx) => solKit.appendTransactionMessageInstructions(
                [mintToCheckedInstruction],
                tx
            )
        );

        const signedTransactionMessage = await solKit.signTransactionMessageWithSigners(transactionMessage);
        const sendAndConfirmTransaction = solKit.sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
        await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'confirmed' });
        const signature = solKit.getSignatureFromTransaction(signedTransactionMessage);
        console.log('Success!', signature);
    } catch (err) {
        console.error(err);
    }
})()