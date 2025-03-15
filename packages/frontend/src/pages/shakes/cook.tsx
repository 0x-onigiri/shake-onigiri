import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit'
import { Transaction } from '@mysten/sui/transactions'
import { TESTNET_PACKAGE_ID } from '@/constants'

export default function Cook() {
  const navigate = useNavigate()
  const [title, setTitle] = useState<string>('')

  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction()
  const [_, setDigest] = useState('')
  const currentAccount = useCurrentAccount()

  // フォーム送信ハンドラー
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentAccount) {
      alert('ウォレット接続してください')
      return
    }

    if (!title.trim()) {
      alert('タイトルを入力してください')
      return
    }

    const tx = new Transaction()
    tx.moveCall({
      target: `${TESTNET_PACKAGE_ID}::blog::create_post`,
      arguments: [tx.pure.string(title), tx.object('0x6')],
    })

    signAndExecuteTransaction(
      {
        transaction: tx,
        chain: 'sui:testnet',
      },
      {
        onSuccess: (result) => {
          console.log('executed transaction', result)
          setDigest(result.digest)
          // window.open(`https://testnet.suivision.xyz/txblock/${result.digest}?tab=Events`, '_blank', 'noopener,noreferrer')
          navigate('/')
        },
      },
    )
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

            <Button
              type="submit"
              className="w-full"
              onClick={handleSubmit}
            >
              Create
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
