export const TransferTarget =  {
    BP: 'BP',
    NON_BP: 'NON_BP'
}

export const TransferType =  {
    SOL: 'SOL',
    SPL: 'SPL',
    SPL_UNCHECKED: 'SPL_UNCHECKED'
}

const INVOICE_PAYMENTS = {
    SOL: 0.1,
    USDC: 50,
    USDT: 50
}

// amount should be in indivisible amount (akin to satoshis)
export const transferInstructions = [
    { target: TransferTarget.BP, type: TransferType.SOL, amount: 66033000 },
    // { target: TransferTarget.BP, type: TransferType.SOL, amount: Math.floor(478234000/2.5) },
    // { target: TransferTarget.NON_BP, type: TransferType.SPL, amount: 10 },
    // { target: TransferTarget.BP, type: TransferType.SPL, amount: 50000000/2 },
    // { target: TransferTarget.BP, type: TransferType.SPL, amount: 50000000/2 },
    // { target: TransferTarget.BP, type: TransferType.SPL_UNCHECKED, amount: 10000 },
    // { target: TransferTarget.BP, type: TransferType.SPL_UNCHECKED, amount: 10000 }
];

export const memo = '3LrRusofL3TSP93qojuPgo41Ey3YCViMGKdSBDoeXH3eocpSkdiSw9uxFM';
export const sendMemo = true;

export const Functionality = {
    PAY: 'pay', // default
    GET_UNSIGNED_TRANSACTION_MESSAGE: 'getUnsignedTransactionMessage',
    GET_SIGNED_TRANSACTION_MESSAGE: 'getSignedTransactionMessage',
} as const;

type FunctionalityType = typeof Functionality[keyof typeof Functionality];

// export const functionality: FunctionalityType = Functionality.GET_UNSIGNED_TRANSACTION_MESSAGE;
export const functionality: FunctionalityType = Functionality.GET_SIGNED_TRANSACTION_MESSAGE;
// export const functionality: FunctionalityType = Functionality.PAY;
