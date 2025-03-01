import type { CachedReaction, ReactionCache } from "../../types";

export class ReactionService {
    private static STORAGE_KEY = "reaction_cache";

    static getCache(): CachedReaction[] {
        const cached = localStorage.getItem(this.STORAGE_KEY);
        return cached ? JSON.parse(cached) : [];
    }

    static saveCache(cache: CachedReaction[]): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cache));
    }

    static addReaction(reaction: CachedReaction): void {
        const cache = this.getCache();

        // Check for duplicates before adding
        const isDuplicate = cache.some(r => r.id === reaction.id);

        if (!isDuplicate) {
            cache.push(reaction);
            this.saveCache(cache);
        }
    }

    static shouldShowUser(userPubkey: string, currentPubkey: string): boolean {
        if (!this.hasInteraction(userPubkey, currentPubkey)) {
            return true;
        }

        return this.canInteract(userPubkey, currentPubkey);
    }

    private static hasInteraction(pubkey1: string, pubkey2: string): boolean {
        const cache = this.getCache();
        return cache.some(
            reaction =>
                (reaction.from === pubkey1 && reaction.to === pubkey2) ||
                (reaction.from === pubkey2 && reaction.to === pubkey1)
        );
    }

    static canInteract(pubkey1: string, pubkey2: string): boolean {
        const cache = this.getCache();

        // Check if there's any rejection between these users
        const hasRejection = cache.some(
            reaction =>
                reaction.content === "-" &&
                ((reaction.from === pubkey1 && reaction.to === pubkey2) ||
                    (reaction.from === pubkey2 && reaction.to === pubkey1))
        );

        return !hasRejection;
    }
} 