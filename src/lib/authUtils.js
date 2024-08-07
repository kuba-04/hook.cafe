import { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { generatePrivateKey } from "nostr-tools";

export function createNewSigner() {
    const privateKey = generatePrivateKey();
    const signer = new NDKPrivateKeySigner(privateKey);
    return signer.privateKey;
};

export function recreateSigner(privateKey) {
    const signer = new NDKPrivateKeySigner(privateKey);
    return signer;
};

export async function setProfileData(ndk, name, city, avatar) {
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

export async function getUserProfile(ndk, pubKey) {
    const user = ndk.getUser({
      npub: pubKey,
    });

    return await user.fetchProfile();
}