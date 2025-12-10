
            {/* Metadata Bar (Progress & Timer) - LIKES TRACKER DISABLED FOR MVP */}
            <div className="flex items-center justify-end bg-zinc-950/50 rounded-lg p-2 mb-3 border border-zinc-800/50">
                <div className="flex flex-col items-end w-full">
                    <div className="flex justify-between w-full items-center mb-1">
                         <span className={`text-[10px] font-bold ${market.status === 'active' ? 'text-green-400' : 'text-zinc-500'}`}>
                            {market.status?.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-zinc-500">Goal: {market.threshold} Likes</span>
                    </div>
                    <Countdown deadline={market.deadline} />
                </div>
            </div>
