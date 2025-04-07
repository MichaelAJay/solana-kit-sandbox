import * as solKit from '@solana/kit';
import * as solToken from '@solana-program/token';
import { pipe } from '@solana/functional';
import { payerPrivateKey } from '../config/secrets';

const config = {
    env: 'dev',
    url: 'api.devnet.solana.com',
    feePayerPrivateKey: payerPrivateKey,
    decimals: 6,
    mint: 'GyzJqvgPYuPnzKew7UZR517wgRR8U16PxHWWgef4fbgs',
    target: 'Av9yqw4ACAwETSFR2Vpp25qNufqG7kvU9ziRKsbeK8J9',
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
            target
        } = config;
        const rpc = solKit.createSolanaRpc(`https://${url}`);
        const rpcSubscriptions = solKit.createSolanaRpcSubscriptions(`wss://${url}`);
        const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

        // Create fee payer
        const feePayer = await (env === 'dev' ? solKit.createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode(feePayerPrivateKey)) : solKit.generateKeyPairSigner());
        const mintAddress = solKit.address(mint);
        const ownerKeypair = await solKit.generateKeyPairSigner();
        // const owner = ownerKeypair.address;
        const owner = solKit.address(target);
        console.log('owner address', owner);

        // Check for existence
        const parsedTokenAccountsByOwner = await rpc.getTokenAccountsByOwner(owner, {
            mint: mintAddress
        }, { encoding: 'base64' }).send();
        console.log('parsedTokenAccountsByOwner', parsedTokenAccountsByOwner);
        
        // Test: Create ATA
        const [destinationAta] = await solToken.findAssociatedTokenPda({
            owner,
            tokenProgram: solKit.address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
            mint: mintAddress
        });
        console.log(destinationAta);
        if (parsedTokenAccountsByOwner?.value[0]) {
            const answer = parsedTokenAccountsByOwner.value[0]?.pubkey;
            console.log(answer, answer === destinationAta);
            return;
        }
        const createAssociatedTokenIdempotentInstruction = solToken.getCreateAssociatedTokenIdempotentInstruction({
            payer: feePayer,
            owner,
            mint: mintAddress,
            ata: destinationAta
        });
        
        const transactionMessage = pipe(
            solKit.createTransactionMessage({ version: 0 }),
            (tx) => solKit.setTransactionMessageFeePayerSigner(feePayer, tx),
            (tx) => solKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
            (tx) => solKit.appendTransactionMessageInstructions(
                [createAssociatedTokenIdempotentInstruction],
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
