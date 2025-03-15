import { Suspense, use } from 'react'
import { useParams, Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'

// Walrus Testnetのアグリゲーターのエンドポイント
const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space'

interface ErrorState {
  message: string
}

interface ArticleContent {
  content: string
  error: ErrorState | null
}

async function fetchArticleContent(blobId: string): Promise<ArticleContent> {
  try {
    const response = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`)

    if (!response.ok) {
      throw new Error(
        `コンテンツの取得に失敗しました: ${response.statusText}`,
      )
    }

    const htmlContent = await response.text()
    return {
      content: htmlContent,
      error: null,
    }
  }
  catch (err) {
    console.error('コンテンツ取得エラー:', err)
    return {
      content: '',
      error: {
        message: err instanceof Error ? err.message : '予期せぬエラーが発生しました',
      },
    }
  }
}

export default function Article() {
  const { blobId } = useParams()

  if (!blobId) {
    return <div>Blob IDが指定されていません</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <Button variant="ghost" asChild className="gap-2">
            <Link to="/">
              ← ホームに戻る
            </Link>
          </Button>
        </div>
      </div>

      <div className="container py-6">

        <Suspense fallback={<div>Loading...</div>}>
          <View promise={fetchArticleContent(blobId)} />
        </Suspense>
      </div>
    </div>
  )
}

function View({
  promise,
}: {
  promise: Promise<ArticleContent>
}) {
  const { content, error } = use(promise)

  // HTMLコンテンツを安全に表示するための関数
  const createContentFrame = () => {
    return {
      __html: `
        <iframe
          srcDoc="${content.replace(/"/g, '&quot;')}"
          class="w-full h-[calc(100vh-4rem)] border-0 overflow-hidden"
          title="記事コンテンツ"
          sandbox="allow-same-origin"
        ></iframe>
      `,
    }
  }

  if (error) {
    return <Alert variant="destructive">{error.message}</Alert>
  }

  if (!content) {
    return <Loader2 className="h-8 w-8 animate-spin text-primary" />
  }

  return (
    <Card className="overflow-hidden">
      <div dangerouslySetInnerHTML={createContentFrame()} />
    </Card>
  )
}
