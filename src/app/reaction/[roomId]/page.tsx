'use client'

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"

type Room = {
    id: number
    player1_id: string | null
    player2_id: string | null
    player1_ready: boolean
    player2_ready: boolean
    game_started: boolean
    game_ended: boolean
}

export default function ReactionRoomPage() {
    const { roomId } = useParams<{ roomId: string }>()
    const router = useRouter()
    const numericRoomId = Number(roomId)
    const [room, setRoom] = useState<Room | null>(null)
    const [playerId, setPlayerId] = useState<string | null>(null)
    const [status, setStatus] = useState<'loading' | 'joined' | 'full' | 'error'>('loading')
    const [isReady, setIsReady] = useState(false)

    // 初始化玩家 ID
    useEffect(() => {
        const pid = localStorage.getItem('reaction-player-id')
        if (!pid) {
            const newId = crypto.randomUUID()
            localStorage.setItem('reaction-player-id', newId)
            setPlayerId(newId)
        } else {
            setPlayerId(pid)
        }
    }, [])

    // 加入房间逻辑
    useEffect(() => {
        if (!playerId || !numericRoomId) return

        async function joinRoom() {
            const { data: roomData, error } = await supabase
                .from('reaction_rooms')  // ✅ 修复这里
                .select('*')
                .eq('id', numericRoomId)
                .single()

            if (error || !roomData) {
                setStatus('error')
                return
            }

            // 判断是否为第三者
            if (
                roomData.player1_id &&
                roomData.player2_id &&
                playerId !== roomData.player1_id &&
                playerId !== roomData.player2_id
            ) {
                setStatus('full')
                return
            }

            // 抢占 player2
            if (roomData.player1_id !== playerId && !roomData.player2_id) {
                const { error: updateError } = await supabase
                    .from('reaction_rooms')
                    .update({ player2_id: playerId })
                    .eq('id', numericRoomId)

                if (updateError) {
                    console.error("Fail to join room", updateError)
                    setStatus('error')
                    return
                }

                roomData.player2_id = playerId
            }

            setRoom(roomData)
            setStatus('joined')
        }

        joinRoom()
    }, [playerId, numericRoomId])

    useEffect(() => {
        if (!roomId) return

        const channel = supabase
            .channel(`reaction_room_${roomId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'reaction_rooms',
                    filter: `id=eq.${roomId}`,
                },
                (payload) => {
                    const updated = payload.new as Room
                    setRoom(updated)

                    if (updated.game_started) {
                        console.log("游戏开始！")
                    }
                }
            )
            .subscribe()
        return () => {
            supabase.removeChannel(channel)
        }
    }, [roomId])

    async function handleReady() {
        if (!room || !playerId) return

        const field = playerId === room.player1_id ? 'player1_ready' : 'player2_ready'

        const { error } = await supabase
            .from('reaction_rooms')
            .update({ [field]: true })
            .eq('id', room.id)

        if (!error) {
            setIsReady(true)
        }
    }

    useEffect(() => {
        if (!room) return

        if (
            room.player1_ready && room.player2_ready && !room.game_started
        ) {
            supabase
                .from('reaction_rooms')
                .update({ game_started: true })
                .eq('id', room.id)
                .then(() => console.log('游戏已启动'))
        }
    })

    if (status === 'loading') return <div className="p-8 text-center">加载中...</div>
    if (status === 'error') return <div className="p-8 text-center text-red-500">房间不存在或加载失败</div>
    if (status === 'full') return <div className="p-8 text-center text-red-500">房间已满，无法加入</div>

    const youAre = playerId === room?.player1_id ? 'Player 1' : 'Player 2'

    return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <h1 className="text-2xl font-bold">⚡ Reaction 对战房间 #{room?.id}</h1>
            <p>你是：{youAre}</p>
            <p>等待对手进入中...</p>
            <p>玩家1：{room?.player1_ready ? '✅ 准备' : '⏳ 未准备'}</p>
            <p>玩家2：{room?.player2_ready ? '✅ 准备' : '⏳ 未准备'}</p>

            {!isReady && <Button onClick={handleReady}></Button>}
            {room?.game_started && <p className="text-green-600 font-semibold">🎮游戏开始！</p>}
            <Button onClick={() => router.push('/')}>退出</Button>
        </div>
    )
}
