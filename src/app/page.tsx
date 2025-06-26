'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  const router = useRouter()

  return (
    <div className="flex flex-col gap-8 items-center justify-center min-h-screen">
      <h1 className="text-3xl font-bold">🎮 双人小游戏平台</h1>

      <div className="flex flex-col gap-4">
        <Button className="w-64" onClick={() => router.push('/witch-poison')}>
          🍬 Witch Poison
        </Button>

        <Button className="w-64" onClick={() => router.push('/gomoku')}>
          ⚫ 五子棋 (Gomoku)
        </Button>

        <Button className="w-64" onClick={() => router.push('/reaction')}>
          ⚡反应训练游戏
        </Button>

        {/* 后续可以继续添加更多游戏 */}
      </div>
    </div>
  )
}
