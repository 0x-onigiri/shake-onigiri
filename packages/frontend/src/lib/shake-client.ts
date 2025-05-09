import { Transaction } from '@mysten/sui/transactions'
import { SHAKE_ONIGIRI } from '@/constants'
import { objResToFields, objResToOwner } from '@polymedia/suitcase-core'
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client'
import type { User, Post, PostMetadata, ReviewReaction, Review, ReviewAuthor } from '@/types'
import { AGGREGATOR } from '@/constants'
import { BlogModule } from '@/lib/sui/blog-functions'
import { uploadToWalrus } from '@/lib/sui/walrus'

const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') })

export async function fetchUser(
  userAddress: string,
) {
  const response = await suiClient.getOwnedObjects({
    owner: userAddress,
    filter: {
      MatchAll: [
        {
          StructType: `${SHAKE_ONIGIRI.testnet.packageId}::user::User`,
        },
      ],
    },
    options: {
      showContent: true,
    },
  })
  const userObject = response.data[0]
  if (!userObject) {
    return null
  }
  const fields = objResToFields(userObject)
  const user: User = {
    id: fields.id.id,
    username: fields.name,
    image: fields.profile_image_id,
    bio: fields.bio,
  }
  return user
}

export async function fetchUserByUserId(
  userId: string,
) {
  const userObject = await suiClient.getObject({
    id: userId,
    options: {
      showContent: true,
    },
  })
  const fields = objResToFields(userObject)
  const user: User = {
    id: fields.id.id,
    username: fields.username,
    image: fields.image,
    bio: fields.bio,
  }
  return user
}

export async function fetchUserPosts(
  userAddress: string,
) {
  const response = await suiClient.getOwnedObjects({
    owner: userAddress,
    filter: {
      MatchAll: [
        {
          StructType: `${SHAKE_ONIGIRI.testnet.packageId}::blog::Post`,
        },
      ],
    },
    options: {
      showContent: true,
    },
  })

  const fields = response.data.map(objResToFields)
  const posts = fields.map((field) => {
    const post: Post = {
      id: field.id.id,
      author: userAddress,
      thumbnailBlobId: field.thumbnail_blob_id,
      title: field.title,
      postBlobId: field.post_blob_id,
      createdAt: new Date(Number(field.created_at)).toLocaleString('ja-JP'),
    }
    return post
  })
  return posts
}

export async function fetchPost(
  postId: string,
) {
  const postObject = await suiClient.getObject({
    id: postId,
    options: {
      showContent: true,
      showOwner: true,
    },
  })
  const fields = objResToFields(postObject)
  const authorAddress = objResToOwner(postObject)

  if (authorAddress === 'unknown') {
    throw new Error('Invalid post owner')
  }

  const postMetadataObject = await suiClient.getObject({
    id: fields.post_metadata_id,
    options: {
      showContent: true,
      showOwner: true,
    },
  })
  const postMetadataFields = objResToFields(postMetadataObject)
  const postMetadata: PostMetadata = {
    id: postMetadataFields.id.id,
    price: postMetadataFields.price ? Number(postMetadataFields.price) : 0,
    reviews: postMetadataFields.reviews.fields.contents || [],
  }

  const post: Post = {
    id: fields.id.id,
    author: authorAddress,
    thumbnailBlobId: fields.thumbnail_blob_id,
    title: fields.title,
    postBlobId: fields.post_blob_id,
    metadata: postMetadata,
    createdAt: new Date(Number(fields.created_at)).toLocaleString('ja-JP'),
  }

  console.log('post', post)

  return post
}

export async function fetchPostContent(
  blobId: string,
) {
  try {
    const response = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`)

    if (!response.ok) {
      throw new Error(
        `コンテンツの取得に失敗しました: ${response.statusText}`,
      )
    }

    return await response.text()
  }
  catch (err) {
    console.error('コンテンツ取得エラー:', err)
  }
}

// TODO: contentが暗号化前提になっているが、無料記事の場合は暗号化しないようにする（別関数でもok）
export async function createPaidPost(tx: Transaction, userObjectId: string, thumbnailBlobId: string, title: string, encryptedContent: Uint8Array, price: number) {
  const postBlobId = await uploadToWalrus(encryptedContent)

  return BlogModule.createPost(
    tx,
    SHAKE_ONIGIRI.testnet.packageId,
    userObjectId,
    thumbnailBlobId,
    title,
    postBlobId,
    price,
  )
}

export async function createFreePost(tx: Transaction, userObjectId: string, thumbnailBlobId: string, title: string, content: string) {
  const postBlobId = await uploadToWalrus(content)

  return BlogModule.createPost(
    tx,
    SHAKE_ONIGIRI.testnet.packageId,
    userObjectId,
    thumbnailBlobId,
    title,
    postBlobId,
  )
}

export async function createReview(tx: Transaction, postMetadataId: string, content: string) {
  if (!content.trim()) {
    throw new Error('レビュー内容を入力してください')
  }

  return BlogModule.createReview(
    tx,
    SHAKE_ONIGIRI.testnet.packageId,
    postMetadataId,
    content,
  )
}

export async function voteForReview(tx: Transaction, reviewId: string, reaction: ReviewReaction) {
  return BlogModule.voteForReview(
    tx,
    SHAKE_ONIGIRI.testnet.packageId,
    reviewId,
    reaction,
  )
}

export async function fetchPostReviews(reviewIds: string[], currentUserAddress?: string) {
  try {
    const reviewObjects = await suiClient.multiGetObjects({
      ids: reviewIds,
      options: {
        showContent: true,
      },
    })

    const authorAddresses = reviewObjects
      .map(reviewObj => objResToFields(reviewObj)?.reviewer)
      .filter((addr): addr is string => !!addr && addr !== 'unknown')
    const uniqueAuthorAddresses = [...new Set(authorAddresses)]
    const authorMap = new Map<string, User | null>()

    for (const addr of uniqueAuthorAddresses) {
      const user = await fetchUser(addr)
      authorMap.set(addr, user)
    }

    const reviews = reviewObjects.map((reviewObj) => {
      const fields = objResToFields(reviewObj)

      if (!fields || !fields.id || !fields.content || !fields.reviewer || fields.reviewer === 'unknown') {
        return null
      }

      const authorAddress = fields.reviewer
      const author = authorMap.get(authorAddress)
      const authorData: ReviewAuthor = {
        name: author ? author.username : '匿名ユーザー',
        image: author ? author.image : undefined,
      }
      const isCurrentUserReview = !!currentUserAddress && currentUserAddress === authorAddress

      let helpfulCount = 0
      let notHelpfulCount = 0
      let currentUserVote: ReviewReaction | null = null

      try {
        if (fields.review_vote_count?.fields?.contents) {
          const voteCountMap = fields.review_vote_count.fields.contents
          for (let i = 0; i < voteCountMap.length; i++) {
            const voteItem = voteCountMap[i]
            if (voteItem.fields) {
              const key = voteItem.fields.key.variant
              const value = Number(voteItem.fields.value)

              if (key === 'Helpful') {
                helpfulCount = value
              }
              else if (key === 'NotHelpful') {
                notHelpfulCount = value
              }
            }
          }
        }

        if (currentUserAddress && fields.review_votes?.fields?.contents) {
          const reviewVotes = fields.review_votes.fields.contents
          for (let i = 0; i < reviewVotes.length; i++) {
            const voteItem = reviewVotes[i]
            if (voteItem.fields && voteItem.fields.key === currentUserAddress) {
              currentUserVote = voteItem.fields.value.variant
              break
            }
          }
        }
      }
      catch (err) {
        console.error('レビュー評価数取得エラー:', err)
      }

      const review: Review = {
        id: fields.id.id,
        content: fields.content,
        author: authorData,
        createdAt: new Date(Number(fields.created_at)).toLocaleString('ja-JP'),
        helpfulCount: helpfulCount,
        notHelpfulCount: notHelpfulCount,
        isCurrentUserReview,
        currentUserVote,
      }

      return review
    }).filter(r => !!r)

    return reviews
  }
  catch (error) {
    console.error('レビュー取得エラー:', error)
    return []
  }
}
