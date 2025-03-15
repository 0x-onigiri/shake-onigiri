import { useState, useRef } from 'react'
import { useSuiClientQuery } from '@mysten/dapp-kit'
import { Button } from '@/components/ui/button'
import { Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn, truncateAddress } from '@/lib/utils'
import { Transaction } from '@mysten/sui/transactions'
import { TESTNET_PACKAGE_ID } from '@/constants'

export default function ShakeList() {
  const { data, isPending, isError, error, refetch } = useSuiClientQuery(
    'queryEvents',
    {
      query: {
        MoveEventType: `${TESTNET_PACKAGE_ID}::blog::PostCreatedEvent`,
      },
    },
  )

  if (!data) {
    return null
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <ul className="grid grid-cols-3 gap-4">
        {data.data.map((item) => {
          const parsedJson = item.parsedJson
          return (
            <li key={parsedJson.postId}>
              <Card>
                <CardHeader>
                  <CardTitle>{parsedJson.title}</CardTitle>
                  <CardDescription>記事本文記事本文記事本文記事本文</CardDescription>
                </CardHeader>
                {/* <CardContent>
              <p>Card Content</p>
            </CardContent> */}
                <CardFooter>
                  <p>
                    by
                    {' '}
                    {truncateAddress(parsedJson.author)}
                  </p>
                </CardFooter>
              </Card>

            </li>
          )
        })}
      </ul>

    </div>
  )
}
