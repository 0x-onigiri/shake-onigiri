module blog::blog;

// === Imports ===

use std::string::{Self, String};
use sui::{
    clock::Clock,
    event,
};

// === Structs ===

public struct Post has key, store {
    id: UID,
    // 投稿者のアドレス
    author: address,
    // 記事タイトル
    title: String,
    // 記事作成日時（タイムスタンプ）
    created_at: u64,
}

// === Events ===

public struct PostCreatedEvent has copy, drop {
    post_id: ID,
    author: address,
    title: String,
    created_at: u64,
}

fun init(_ctx: &mut TxContext) {}

// === Public Functions ===

public fun create_post(
    title: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext
) {
    let timestamp = clock.timestamp_ms();

    let post = Post {
        id: object::new(ctx),
        author: ctx.sender(),
        title: string::utf8(title),
        created_at: timestamp,
    };

    event::emit(PostCreatedEvent {
        post_id: object::id(&post),
        author: tx_context::sender(ctx),
        title: string::utf8(title),
        created_at: timestamp,
    });

    transfer::share_object(post);
}
