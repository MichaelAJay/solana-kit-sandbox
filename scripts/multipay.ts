import { secretKeys } from '../private-keys';
import * as solKit from '@solana/kit';
import * as solMemo from '@solana-program/memo';
import * as solSystem from '@solana-program/system';
import * as solToken from '@solana-program/token';
import { pipe } from '@solana/functional';
import { transferInstructions, TransferType, TransferTarget, memo, sendMemo, functionality, Functionality } from './multipay-instructions';

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
    memo,
    sendMemo
}

const ataAddressExample = solKit.address("J6duDTMFGLehTenoP4Xmbc3FumgjpDdcbmnrVnR49NWe");
const rpc = solKit.createSolanaRpc(`https://${config.url}`);
const rpcSubscriptions = solKit.createSolanaRpcSubscriptions(`wss://${config.url}`);
const bs58Encoder = solKit.getBase58Encoder();
const bs58Decoder = solKit.getBase58Decoder();
const myOffMintATA = '655uiPSN45Qwu58SNbh3GJV9YGHgV1NzcJPniBEPnYW2';

const generateTransferSolInstruction = ({ source, destinationAddress, amount }:
    {source: solKit.KeyPairSigner<string>; destinationAddress: solKit.Address<string>; amount: number}
) => {
    return solSystem.getTransferSolInstruction({
        amount,
        destination: destinationAddress,
        // destination: ataAddressExample,
        source
      })
}

const generateTransferCheckedInstruction = async ({ source, destinationAddress, amount }:
    { source: solKit.KeyPairSigner<string>; destinationAddress: solKit.Address<string>; amount: number; }
) => {
        const mint = solKit.address(config.mintAddress);
        // Derive the atas
        const [sourceAtaAddress] = await solToken.findAssociatedTokenPda({ owner: source.address, tokenProgram: solToken.TOKEN_PROGRAM_ADDRESS, mint });
        // const [destinationAtaAddress] = await solToken.findAssociatedTokenPda({ owner: destinationAddress, tokenProgram: solToken.TOKEN_PROGRAM_ADDRESS, mint });
        const destinationAtaAddress = solKit.address(myOffMintATA);
        // console.log('src', source.address, 'ata', sourceAtaAddress);
        // console.log('destination', destinationAddress, 'ata', destinationAtaAddress);

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
    // console.log(sourceAtaAddress, destinationAtaAddress);

    return solToken.getTransferInstruction({
        source: sourceAtaAddress,
        // source: destinationAtaAddress,
        destination: destinationAtaAddress,
        authority: solKit.address(config.mintAuthority),
        // authority: destinationAddress,
        amount
    })
}

const generateTransactionMessage = async ({ transferInstructions, feePayer, latestBlockhash, setFeePayerSigner }: {transferInstructions: any[]; feePayer: solKit.KeyPairSigner<string>, latestBlockhash: Readonly<{
    blockhash: solKit.Blockhash;
    lastValidBlockHeight: bigint;
}>; setFeePayerSigner: boolean}) => {
    const instructionsToAppend = [...transferInstructions];
    if (config.sendMemo !== false) { // Explicit false check
        const memoInstruction = solMemo.getAddMemoInstruction({
            memo: config.memo
        })
        instructionsToAppend.push(memoInstruction);
        // Tests behavior w/ multiple memo instructions
        // const memoInstruction2 = solMemo.getAddMemoInstruction({
        //     memo: 'Second memo instruction'
        // })
        // instructionsToAppend.push(memoInstruction2);
    }
    // console.log(transferInstructions);

    // Create transaction I guess
    const transactionMessage = pipe(
        solKit.createTransactionMessage({ version: 0 }),
        setFeePayerSigner ? (tx) => solKit.setTransactionMessageFeePayerSigner(feePayer, tx) : (tx) => solKit.setTransactionMessageFeePayer(feePayer.address, tx),
        (tx) => solKit.setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => solKit.appendTransactionMessageInstructions(
            instructionsToAppend,
            tx
        )
    );

    return transactionMessage;
}

const signTransactionMessageWithSigners = async ({ transactionMessage }: { transactionMessage: any }) => {
    return await solKit.signTransactionMessageWithSigners(transactionMessage);
}

const sendAndConfirmTransaction = async ({ signedTransactionMessage }: { signedTransactionMessage: any }) => {
    const sendAndConfirmTransaction =  solKit.sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
    return await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'confirmed' });
}

const getBase64EncodedWireTransaction = ({ transactionMessage, compileMessage }: { transactionMessage: any; compileMessage: boolean }) => {
    const compiledTx = compileMessage ? solKit.compileTransaction(transactionMessage) : transactionMessage;
    return solKit.getBase64EncodedWireTransaction(compiledTx);
}

const pay = async ({ transferInstructions, feePayer, latestBlockhash }:
    {transferInstructions: any[]; feePayer: solKit.KeyPairSigner<string>, latestBlockhash: Readonly<{
        blockhash: solKit.Blockhash;
        lastValidBlockHeight: bigint;
    }>}
) => {
    const transactionMessage = await generateTransactionMessage({ transferInstructions, feePayer, latestBlockhash, setFeePayerSigner: true });
    const signedTransactionMessage = await signTransactionMessageWithSigners({ transactionMessage });
    // console.log('Signed, not sent. Below are public key address - signature pairs');
    // for (const [key, signature] of Object.entries(signedTransactionMessage.signatures)) {
    //     if (!signature) continue;
    //     console.log(key, bs58Decoder.decode(signature));
    // }
    const sendAndConfirmTransaction = solKit.sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
    const signature = solKit.getSignatureFromTransaction(signedTransactionMessage);
    console.log('signed not sent', signature);
    await sendAndConfirmTransaction(signedTransactionMessage, { commitment: 'confirmed' });
    return signature;
}

(async () => {
    try {
        const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

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
        // console.log(transactionTransferInstructions);

        const setFeePayerSigner = functionality !== Functionality.GET_UNSIGNED_TRANSACTION_MESSAGE;
        const transactionMessage = await generateTransactionMessage({ transferInstructions: transactionTransferInstructions, feePayer: payer, latestBlockhash, setFeePayerSigner });
        switch (functionality) {
            case Functionality.GET_UNSIGNED_TRANSACTION_MESSAGE:
                const encodedWireTransaction = getBase64EncodedWireTransaction({ transactionMessage, compileMessage: true });
                console.log(encodedWireTransaction);
                break;
            case Functionality.GET_SIGNED_TRANSACTION_MESSAGE:
                const signedTransaction = await signTransactionMessageWithSigners({ transactionMessage });
                const encodedWireSignedTransaction = getBase64EncodedWireTransaction({ transactionMessage: signedTransaction, compileMessage: false });
                console.log(encodedWireSignedTransaction);
                break;
            case Functionality.PAY:
            default:
                const signature = await pay({ transferInstructions: transactionTransferInstructions, feePayer: payer, latestBlockhash });
                console.log('Transaction successful', signature);
        }
        console.log('Finished');
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})()