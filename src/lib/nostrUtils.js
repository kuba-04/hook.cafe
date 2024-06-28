import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { generatePrivateKey } from "nostr-tools";


export const createNewSigner = () => {
    const privateKey = generatePrivateKey();
    const signer = new NDKPrivateKeySigner(privateKey);
    return signer;
};

export const recreateSigner = (privateKey) => {
    const signer = new NDKPrivateKeySigner(privateKey);
    return signer;
};

