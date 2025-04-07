import { secretKeys } from '../private-keys';
import * as solKit from '@solana/kit';
import * as solMemo from '@solana-program/memo';
import * as solSystem from '@solana-program/system';
import * as solToken from '@solana-program/token';
import { pipe } from '@solana/functional';
import { transferInstructions, TransferType, TransferTarget } from './multipay-instructions';

const { payer: payerSecretKey, bp_receiver: bpReceiverSecretKey, non_bp_receiver: nonBpReceiverSecretKey } = secretKeys;
export const config = {
    env: 'dev',
    url: 'api.devnet.solana.com',
    feePayerSecretKey: payerSecretKey,
    senderSecretKey: payerSecretKey,
    bpReceiverSecretKey: bpReceiverSecretKey,
    nonBpReceiverSecretKey: nonBpReceiverSecretKey,
    mintAddress: 'GyzJqvgPYuPnzKew7UZR517wgRR8U16PxHWWgef4fbgs',
    mintAuthority: '3v1MBkq73yuitDZKtje2RkZUuVtg6KA2jNgz8EcbqiS7',
    decimals: 6,
    memo: 'my_memo',
    sendMemo: false
}


const rpc = solKit.createSolanaRpc(`https://${config.url}`);
const rpcSubscriptions = solKit.createSolanaRpcSubscriptions(`wss://${config.url}`);
const bs58Encoder = solKit.getBase58Encoder();
const bs58Decoder = solKit.getBase58Decoder();

const generateTransferSolInstruction = ({ source, destinationAddress, amount }:
    {source: solKit.KeyPairSigner<string>; destinationAddress: solKit.Address<string>; amount: number}
) => {
    return solSystem.getTransferSolInstruction({
        amount,
        destination: destinationAddress,
        source
      })
}

const generateTransferCheckedInstruction = async ({ source, destinationAddress, amount }:
    { source: solKit.KeyPairSigner<string>; destinationAddress: solKit.Address<string>; amount: number; }
) => {
        const mint = solKit.address(config.mintAddress);
        // Derive the atas
        const [sourceAtaAddress] = await solToken.findAssociatedTokenPda({ owner: source.address, tokenProgram: solToken.TOKEN_PROGRAM_ADDRESS, mint });
        const [destinationAtaAddress] = await solToken.findAssociatedTokenPda({ owner: destinationAddress, tokenProgram: solToken.TOKEN_PROGRAM_ADDRESS, mint });
        console.log('src', source.address, 'ata', sourceAtaAddress);
        console.log('destination', destinationAddress, 'ata', destinationAtaAddress);

        return solToken.getTransferCheckedInstruction({
            source: sourceAtaAddress,
            mint,
            destination: destinationAtaAddress,
            authority: solKit.address(config.mintAuthority),
            amount,
            decimals: config.decimals
        })
}

const generateTransferInstruction = async ({ source, destinationAddress, amount }:
    { source: solKit.KeyPairSigner<string>; destinationAddress: solKit.Address<string>; amount: number; }
) => {
    const mint = solKit.address(config.mintAddress);
    // Derive the atas
    const [sourceAtaAddress] = await solToken.findAssociatedTokenPda({ owner: source.address, tokenProgram: solToken.TOKEN_PROGRAM_ADDRESS, mint });
    const [destinationAtaAddress] = await solToken.findAssociatedTokenPda({ owner: destinationAddress, tokenProgram: solToken.TOKEN_PROGRAM_ADDRESS, mint });
    console.log(sourceAtaAddress, destinationAtaAddress);

    return solToken.getTransferInstruction({
        source: sourceAtaAddress,
        destination: destinationAtaAddress,
        authority: solKit.address(config.mintAuthority),
        amount
    })
}

const pay = async ({ transferInstructions, feePayer }:
    {transferInstructions: any[]; feePayer: solKit.KeyPairSigner<string>}
) => {
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
    
    const instructionsToAppend = [...transferInstructions];
    if (config.sendMemo) {
        const memoInstruction = solMemo.getAddMemoInstruction({
            memo: config.memo
        })
        instructionsToAppend.push(memoInstruction);
    }

    // Create transaction I guess
    const transactionMessage = pipe(
        solKit.createTransactionMessage({ version: 0 }),
        (tx) => solKit.setTransactionMessageFeePayerSigner(feePayer, tx),
        (tx) => solKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => solKit.appendTransactionMessageInstructions(
            instructionsToAppend,
            tx
        )
    );
    const signedTransactionMessage = await solKit.signTransactionMessageWithSigners(transactionMessage);
    console.log('Signed, not sent. Below are public key address - signature pairs');
    for (const [key, signature] of Object.entries(signedTransactionMessage.signatures)) {
        if (!signature) continue;
        console.log(key, bs58Decoder.decode(signature));
    }
    const sendAndConfirmTransaction = solKit.sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
    await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'confirmed' });
    const signature = solKit.getSignatureFromTransaction(signedTransactionMessage);
    return signature;
}

(async () => {
    try {
        const payer = await solKit.createKeyPairSignerFromBytes(Uint8Array.from(config.feePayerSecretKey));
        const bpReceiverKeypair = await solKit.createKeyPairSignerFromBytes(Uint8Array.from(config.bpReceiverSecretKey));
        const nonBpReceiverKeypair = await solKit.createKeyPairSignerFromBytes(Uint8Array.from(config.nonBpReceiverSecretKey));

        const transactionTransferInstructions = await Promise.all(transferInstructions.map(async (instruction) => {
            const targetKeypair = instruction.target === TransferTarget.BP ? bpReceiverKeypair : nonBpReceiverKeypair;
            const baseTransferParams = { source: payer, destinationAddress: targetKeypair.address, amount: instruction.amount }

            switch (instruction.type) {
                case TransferType.SOL:
                    return generateTransferSolInstruction(baseTransferParams);
                case TransferType.SPL: 
                    return generateTransferCheckedInstruction(baseTransferParams)
                case TransferType.SPL_UNCHECKED:
                    return generateTransferInstruction(baseTransferParams)
            }
        }));
        const signature = await pay({ transferInstructions: transactionTransferInstructions, feePayer: payer });
        console.log('Transaction successful', signature);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})()