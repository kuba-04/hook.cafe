import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { generatePrivateKey } from "nostr-tools";
import CryptoJS from 'crypto-js';

// todo replace from props
const PASSPHRASE = 'askdjfaslkdfjnaslkjfnasdkfljn';

export const createNewSigner = () => {
    const privateKey = generatePrivateKey();
    const signer = new NDKPrivateKeySigner(privateKey);
    return signer;
};

export const recreateSigner = (privateKey) => {
    const signer = new NDKPrivateKeySigner(privateKey);
    return signer;
};

// TODO: this is PoC, must replace with some secure way 
export const encryptKey = (key) => {
    return CryptoJS.AES.encrypt(key, PASSPHRASE).toString();
};

export const decryptKey = (encryptedKey) => {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, PASSPHRASE);
    return bytes.toString(CryptoJS.enc.Utf8);
};

export const register = async () => {
    const signer = createNewSigner();
    localStorage.setItem('secure', encryptKey(signer.privateKey));
    return signer;
};

// @Deprecated
export const setName = async (ndk) => {
    const name = localStorage.getItem('user');
    const metadataEvent = new NDKEvent(ndk);
    metadataEvent.kind = 0;
    const content = JSON.stringify({
      name: name
    });
    metadataEvent.content = content;
    await metadataEvent.sign();
    await metadataEvent.publish();
}


export const setProfileData = async (ndk, name, city, avatar) => {
    const metadataEvent = new NDKEvent(ndk);
    metadataEvent.kind = 0;
    const content = JSON.stringify({
      name: name,
      city: city,
      avatar: avatar,
    });
    metadataEvent.content = content;
    await metadataEvent.sign();
    await metadataEvent.publish();
}

//@Deprecated
export const getUserProfileName = async (ndk, pubKey) => {
    const user = ndk.getUser({
      npub: pubKey,
    });

    await user.fetchProfile();
    return user.profile.name || '';
}

export const getUserProfile = async (ndk, pubKey) => {
    const user = ndk.getUser({
      npub: pubKey,
    });

    return await user.fetchProfile();
}

// export const getUserProfilePubKey = async (ndk, pubKey) => {
//     const user = ndk.getUser({
//       pubkey: pubKey,
//     });

//     return await user.fetchProfile();
// }

export function getUserProfilePubKey(ndk, pubkey) {
    const user = ndk.getUser({
        pubkey: pubkey,
      });

    user.fetchProfile();
    // console.log('user.profile ', user.profile)
    return user.profile;
}