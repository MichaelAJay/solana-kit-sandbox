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
    { target: TransferTarget.BP, type: TransferType.SOL, amount: 100 },
    { target: TransferTarget.NON_BP, type: TransferType.SPL, amount: 10 },
    { target: TransferTarget.BP, type: TransferType.SPL, amount: 10 }
];