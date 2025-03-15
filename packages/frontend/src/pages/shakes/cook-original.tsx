import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

// Walrus Testnetのパブリッシャーとアグリゲーターのエンドポイント
const PUBLISHER = 'https://publisher.walrus-testnet.walrus.space'
const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space'

// 型定義
interface UploadedImage {
  id: number
  blobId: string
  suiObjectId: string
  url: string
  file: File
  name: string
  cost: number
  rawResponse: Record<string, unknown>
}

interface UploadResult {
  htmlBlobId: string
  htmlSuiObjectId: string
  htmlUrl: string
  articleUrl: string
  htmlCost: number
  totalCost: number
  uploadedImages: UploadedImage[]
  rawResponse: Record<string, unknown>
}

export default function Cook() {
  const [title, setTitle] = useState<string>('')
  const [content, setContent] = useState<string>('')
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [currentImageUploading, setCurrentImageUploading] = useState<boolean>(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 画像選択ハンドラー
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setCurrentImageUploading(true)

      // 画像をWalrusにアップロード
      const imageResponse = await uploadImageToWalrus(file)

      let imageBlobId = ''
      let imageSuiObjectId = ''
      let imageCost = 0

      if (imageResponse.newlyCreated) {
        imageBlobId = imageResponse.newlyCreated.blobObject.blobId
        imageSuiObjectId = imageResponse.newlyCreated.blobObject.id
        imageCost = imageResponse.newlyCreated.cost || 0
      }
      else if (imageResponse.alreadyCertified) {
        imageBlobId = imageResponse.alreadyCertified.blobId
        // alreadyCertifiedの場合はオブジェクトIDが直接含まれていない可能性があります
        // トランザクションダイジェストから取得する必要があるかもしれません
        imageSuiObjectId
          = imageResponse.alreadyCertified.event?.txDigest || '不明'
      }

      if (imageBlobId) {
        const imageUrl = `${AGGREGATOR}/v1/blobs/${imageBlobId}`

        // 新しい画像情報を追加
        const newImage: UploadedImage = {
          id: Date.now(),
          blobId: imageBlobId,
          suiObjectId: imageSuiObjectId,
          url: imageUrl,
          file: file,
          name: file.name,
          cost: imageCost,
          rawResponse: imageResponse, // 生のレスポンスを保存
        }

        setUploadedImages(prev => [...prev, newImage])

        // テキストエリアのカーソル位置に画像プレースホルダーを挿入
        insertImagePlaceholder(newImage)
      }
    }
    catch (err: unknown) {
      const error = err as Error
      setError(`画像アップロードエラー: ${error.message}`)
    }
    finally {
      setCurrentImageUploading(false)
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // テキストエリアのカーソル位置に画像プレースホルダーを挿入
  const insertImagePlaceholder = (image: UploadedImage) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursorPos = textarea.selectionStart
    const textBefore = content.substring(0, cursorPos)
    const textAfter = content.substring(cursorPos)

    // 画像プレースホルダーを挿入
    const imagePlaceholder = `\n![${image.name}](${image.url})\n`

    const newContent = textBefore + imagePlaceholder + textAfter
    setContent(newContent)

    // カーソル位置を更新
    setTimeout(() => {
      textarea.focus()
      const newCursorPos = cursorPos + imagePlaceholder.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 0)
  }

  // コンテンツをWalrusにアップロード
  const uploadContentToWalrus = async (content: string) => {
    try {
      const response = await fetch(`${PUBLISHER}/v1/blobs`, {
        method: 'PUT',
        body: content,
      })

      if (!response.ok) {
        throw new Error(`アップロード失敗: ${response.statusText}`)
      }

      return await response.json()
    }
    catch (error) {
      console.error('コンテンツアップロードエラー:', error)
      throw error
    }
  }

  // 画像をWalrusにアップロード
  const uploadImageToWalrus = async (file: File) => {
    try {
      const response = await fetch(`${PUBLISHER}/v1/blobs`, {
        method: 'PUT',
        body: file,
      })

      if (!response.ok) {
        throw new Error(`画像アップロード失敗: ${response.statusText}`)
      }

      return await response.json()
    }
    catch (error) {
      console.error('画像アップロードエラー:', error)
      throw error
    }
  }

  // マークダウンをHTMLに変換
  const convertMarkdownToHtml = (markdown: string) => {
    // 非常に簡易的なマークダウン変換
    // 画像
    let html = markdown.replace(
      /!\[(.*?)\]\((.*?)\)/g,
      '<img src="$2" alt="$1" style="max-width:100%;">',
    )

    // 見出し
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>')
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>')
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>')

    // 段落
    html = html.replace(/^(?!<h|<img)(.*?)$/gm, '<p>$1</p>')

    // 改行を保持
    html = html.replace(/\n/g, '')

    return html
  }

  // HTMLページを生成
  const generateHtmlPage = (title: string, content: string) => {
    // マークダウンをHTMLに変換
    const htmlContent = convertMarkdownToHtml(content)

    return `
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 {
            color: #2c3e50;
            margin-bottom: 20px;
          }
          h2 {
            color: #3a536b;
            margin-top: 30px;
            margin-bottom: 15px;
          }
          h3 {
            color: #4a6781;
            margin-top: 25px;
            margin-bottom: 10px;
          }
          img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin: 20px 0;
            display: block;
          }
          p {
            margin-bottom: 16px;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="content">
          ${htmlContent}
        </div>
      </body>
      </html>
    `
  }

  // フォーム送信ハンドラー
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !content.trim()) {
      setError('タイトルと本文を入力してください')
      return
    }

    setIsUploading(true)
    setError(null)
    setResult(null)

    try {
      // HTMLページを生成
      const htmlPage = generateHtmlPage(title, content)

      // HTMLをWalrusにアップロード
      const htmlResponse = await uploadContentToWalrus(htmlPage)

      let htmlBlobId = ''
      let htmlSuiObjectId = ''
      let htmlCost = 0

      if (htmlResponse.newlyCreated) {
        htmlBlobId = htmlResponse.newlyCreated.blobObject.blobId
        htmlSuiObjectId = htmlResponse.newlyCreated.blobObject.id
        htmlCost = htmlResponse.newlyCreated.cost || 0

        // レスポンスの詳細をコンソールに出力（デバッグ用）
        console.log('HTML Upload Response:', htmlResponse)
      }
      else if (htmlResponse.alreadyCertified) {
        htmlBlobId = htmlResponse.alreadyCertified.blobId
        // alreadyCertifiedの場合はオブジェクトIDが直接含まれていない可能性があります
        htmlSuiObjectId
          = htmlResponse.alreadyCertified.event?.txDigest || '不明'
      }

      if (htmlBlobId) {
        const htmlUrl = `${AGGREGATOR}/v1/blobs/${htmlBlobId}`
        const articleUrl = `/articles/${htmlBlobId}`

        // 総コストを計算
        const totalCost
          = htmlCost
            + uploadedImages.reduce((sum, img) => sum + (img.cost || 0), 0)

        setResult({
          htmlBlobId,
          htmlSuiObjectId,
          htmlUrl,
          articleUrl,
          htmlCost,
          totalCost,
          uploadedImages,
          rawResponse: htmlResponse, // デバッグ用に生のレスポンスも保存
        })
      }
      else {
        throw new Error('HTMLのブロブIDが見つかりません')
      }
    }
    catch (err: unknown) {
      const error = err as Error
      setError(`エラーが発生しました: ${error.message}`)
    }
    finally {
      setIsUploading(false)
    }
  }

  // FROSTをSUIに変換（1 WAL = 10^9 FROST, 表示用）
  const formatCost = (frostAmount: number) => {
    if (!frostAmount) return '0'
    // FROSTをWALに変換（1 WAL = 10^9 FROST）
    const walAmount = frostAmount / 1000000000
    return walAmount.toFixed(9)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">New Shake</h1>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">タイトル</Label>
              <Input
                id="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="タイトルを入力"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content">本文 (マークダウン形式)</Label>
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={currentImageUploading}
                  variant="outline"
                  size="sm"
                  className={cn(
                    'text-sm',
                    currentImageUploading && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {currentImageUploading ? '画像アップロード中...' : '画像を挿入'}
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />
              </div>
              <Textarea
                id="content"
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="本文を入力（マークダウン形式で記述できます）&#10;# 見出し1&#10;## 見出し2&#10;通常の段落"
                className="min-h-[300px]"
              />
              <p className="text-xs text-muted-foreground">
                カーソル位置に画像が挿入されます
              </p>
            </div>

            {uploadedImages.length > 0 && (
              <div className="border border-border rounded-md p-4 bg-muted/50">
                <p className="text-sm font-medium mb-2">アップロード済み画像:</p>
                <div className="flex flex-wrap gap-3">
                  {uploadedImages.map(image => (
                    <div
                      key={image.id}
                      className="relative w-24 group"
                    >
                      <img
                        src={image.url}
                        alt={image.name}
                        className="w-full h-24 object-cover rounded-md border border-border"
                      />
                      <div className="text-xs truncate mt-1 text-muted-foreground">
                        {image.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={isUploading}
              className="w-full"
            >
              {isUploading ? 'アップロード中...' : 'Walrusにアップロード'}
            </Button>
          </form>
        </CardContent>

        {error && (
          <div className="mx-6 mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-md text-destructive">
            {error}
          </div>
        )}

        {result && (
          <CardFooter className="flex flex-col p-6 bg-primary/5 border-t border-border">
            <CardTitle className="text-xl font-semibold text-primary mb-4">アップロード成功！</CardTitle>

            <div className="space-y-3 w-full">
              <div>
                <p className="text-sm font-medium text-muted-foreground">記事URL:</p>
                <a
                  href={result.articleUrl}
                  className="text-primary hover:underline break-all"
                >
                  {window.location.origin}
                  {result.articleUrl}
                </a>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">HTMLブロブID:</p>
                <p className="break-all">{result.htmlBlobId}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">HTML Suiオブジェクト:</p>
                <a
                  href={`https://suiexplorer.com/object/${result.htmlSuiObjectId}?network=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {result.htmlSuiObjectId}
                </a>
                {result.htmlCost > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    (コスト:
                    {' '}
                    {formatCost(result.htmlCost)}
                    {' '}
                    WAL)
                  </span>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Walrus直接URL:</p>
                <a
                  href={result.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {result.htmlUrl}
                </a>
              </div>

              {result.totalCost > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">総コスト:</p>
                  <p>
                    {formatCost(result.totalCost)}
                    {' '}
                    WAL
                    <span className="ml-2 text-sm text-muted-foreground">
                      (Testnetのため実際の支払いは発生しません)
                    </span>
                  </p>
                </div>
              )}

              {result.uploadedImages.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm font-medium mb-2">使用画像一覧:</p>
                  <ul className="space-y-3">
                    {result.uploadedImages.map(image => (
                      <li key={image.id} className="text-sm">
                        <div className="flex items-start">
                          <img
                            src={image.url}
                            alt={image.name}
                            className="w-10 h-10 object-cover rounded mr-3"
                          />
                          <div>
                            <a
                              href={image.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-medium"
                            >
                              {image.name}
                            </a>
                            <div className="text-xs text-muted-foreground mt-1">
                              <span>
                                ブロブID:
                                {image.blobId}
                              </span>
                              <span className="mx-1">•</span>
                              <a
                                href={`https://suiexplorer.com/object/${image.suiObjectId}?network=testnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                Suiオブジェクト
                              </a>
                              {image.cost > 0 && (
                                <span className="ml-1">
                                  (コスト:
                                  {' '}
                                  {formatCost(image.cost)}
                                  {' '}
                                  WAL)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <details className="mt-2 ml-13">
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            画像レスポンス詳細
                          </summary>
                          <pre className="mt-2 p-3 bg-muted rounded-md overflow-auto text-xs max-h-40">
                            {JSON.stringify(image.rawResponse, null, 2)}
                          </pre>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <details className="mt-4 pt-4 border-t border-border">
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  HTML記事レスポンス詳細
                </summary>
                <pre className="mt-2 p-3 bg-muted rounded-md overflow-auto text-xs max-h-60">
                  {JSON.stringify(result.rawResponse, null, 2)}
                </pre>
              </details>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
