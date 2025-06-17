'use client'

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { useParams } from "next/navigation"
import { v4 as uuidv4 } from "uuid"

type Cell = 'empty' | 'black' | 'white'

type Board = Cell[][]

type Room = {
    id: number
    board: Board
    winner: string | null
    playerA: string | null
    playerB: string | null
    current_turn: 'playerA' | 'playerB'
}

export default function GomokuGamePage() {
    const { roomId } = useParams<{ roomId: string }>()
    const numericRoomId = Number(roomId)
    const [room, setRoom] = useState<Room | null>(null)
    const [loading, setLoading] = useState(true)
    const [role, setRole] = useState<'playerA' | 'playerB' | null>(null)
    const [playerId, setPlayerId] = useState<string | null>(null)

    useEffect(() => {
        if (typeof window === 'undefined') return
        let id = localStorage.getItem('playerId')
        if (!id) {
            id = uuidv4()
            localStorage.setItem('playerId', id)
        }
        setPlayerId(id)
    }, [])

    useEffect(() => {
        if (!numericRoomId) return
        const channel = supabase
            .channel('room-realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'gomoku',
                filter: `id=eq.${numericRoomId}`,
            }, (payload) => {
                const newData = payload.new as Room
                setRoom(newData)
            })
            .subscribe()
        return () => {
            supabase.removeChannel(channel)
        }
    }, [numericRoomId])

    useEffect(() => {
        async function fetchRoom() {
            const { data } = await supabase
                .from('gomoku')
                .select('*')
                .eq('id', numericRoomId)
                .single()
            if (data) setRoom(data)
            setLoading(false)
        }
        if (roomId) fetchRoom()
    }, [numericRoomId, roomId])

    useEffect(() => {
        if (!room || !playerId) return

        const bindRole = async () => {
            if (!room.playerA) {
                await supabase.from('gomoku').update({ playerA: playerId }).eq('id', numericRoomId)
                setRole('playerA')
            } else if (room.playerA === playerId) {
                setRole('playerA')
            } else if (!room.playerB) {
                await supabase.from('gomoku').update({ playerB: playerId }).eq('id', numericRoomId)
                setRole('playerB')
            } else if (room.playerB === playerId) {
                setRole('playerB')
            }
        }
        bindRole()
    }, [room, playerId, numericRoomId])

    function checkWin(board: Board, row: number, col: number, color: 'black' | 'white'): boolean {
        const directions = [
            [0, 1],
            [1, 0],
            [1, 1],
            [1, -1],
        ]
        for (let [dx, dy] of directions) {
            let count = 1

            for (let step = 1; step < 5; step++) {
                const r = row + dx * step
                const c = col + dy * step
                if (r < 0 || c < 0 || r >= board.length || c >= board[0].length) break
                if (board[r][c] === color) count++
                else break
            }

            for (let step = 1; step < 5; step++) {
                const r = row - dx * step
                const c = col - dy * step
                if (r < 0 || c < 0 || r >= board.length || c >= board[0].length) break
                if (board[r][c] === color) count++
            }
            if (count >= 5) return true
        }
        return false
    }

    async function handlePlacePiece(row: number, col: number) {
        if (!room || room.board[row][col] !== 'empty' || room.winner) return
        if (room?.current_turn !== role) {
            alert("还没轮到你呢！")
            return
        }

        const newBoard = room.board.map((r, ri) =>
            r.map((cell, ci) => (ri === row && ci === col ? (role === 'playerA' ? 'black' : 'white') : cell))
        )

        const winner = checkWin(newBoard, row, col, role === 'playerA' ? 'black' : 'white') ? role : null

        await supabase
            .from('gomoku')
            .update({
                board: newBoard,
                current_turn: role === 'playerA' ? 'playerB' : 'playerA',
                ...(winner && { winner }),
            }).eq('id', numericRoomId)
    }

    async function handleRestartGame() {
        const size = 15;
        const emptyBoard = Array.from({ length: size }, () => Array(size).fill('empty'))

        await supabase
            .from('gomoku')
            .update({
                board: emptyBoard,
                current_turn: 'playerA',
                winner: null,
            }).eq('id', numericRoomId)
    }

    if (!room || loading || !playerId) return <div>Loading...</div>
    if (!role) return <div>等待加入房间中。。。</div>

    return (
        <div className="flex flex-col items-center gap-2 p-4">
            <h1 className="text-xl font-bold">五子棋</h1>
            <div className="flex flex-col gap-[2px]">
                {room.board.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex gap-[2px]">
                        {row.map((cell, colIndex) => (
                            <Button
                                key={`${rowIndex}-${colIndex}`}
                                onClick={() => handlePlacePiece(rowIndex, colIndex)}
                                className={`w-6 h-6 p-0 rounded-full ${cell === 'black' ? 'bg-black' : cell === 'white' ? 'bg-white border border-black' : 'bg-gray-200'}`}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {room.winner && (
                <div className="mt-4 text-lg font-semibold text-red-500">
                    🎉 胜者: {room.winner}
                </div>
            )}

            {room.winner && (
                <Button onClick={handleRestartGame} className="mt-2">
                    重新开始
                </Button>
            )}
        </div>
    )
}