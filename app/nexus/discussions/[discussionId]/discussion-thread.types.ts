export type DiscussionItem = {
    id: string;
    title: string;
    body?: string;
    createdAt?: string | null;
    updatedAt?: string | null;
    category?: string | null;
    tags?: string[];
};

export type Reply = {
    id: string;
    body: string;
    authorId: string;
    createdAt?: any;
    updatedAt?: any;
    parentId?: string | null;
    replyToId?: string | null;
    replyToHandle?: string | null;
    userName?: string | null;
    userHandle?: string | null;
    userPhotoURL?: string | null;
};

export type ReplyTarget =
    | {
        parentId: string | null;
        replyToId?: string | null;
        replyToHandle?: string | null;
    }
    | null;

export type UserCacheMap = Record<
    string,
    {
        name?: string | null;
        handle?: string | null;
        photoURL?: string | null;
    }
>;