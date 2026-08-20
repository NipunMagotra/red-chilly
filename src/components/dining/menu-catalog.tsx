'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Flame,
  Moon,
  Plus,
  Minus,
  Search,
} from 'lucide-react'
import { MenuItemRecord } from '@/lib/data/restaurant-data'
import { useDineScanStore } from '@/lib/store/useStore'

interface MenuCatalogProps {
  menuItems: MenuItemRecord[]
  locationName: string
}

export function MenuCatalog({ menuItems, locationName }: MenuCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedDietary, setSelectedDietary] = useState<string | null>(null)

  const { cart, addToCart, updateQuantity } = useDineScanStore()

  const categories = useMemo(() => {
    const cats = ['All', ...Array.from(new Set(menuItems.map((it) => it.category)))]
    return cats
  }, [menuItems])

  const filteredItems = useMemo(() => {
    return menuItems.filter((item) => {
      const matchCategory =
        selectedCategory === 'All' || item.category === selectedCategory
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchDietary =
        !selectedDietary ||
        item.dietaryTags.some((tag) =>
          tag.toLowerCase().includes(selectedDietary.toLowerCase())
        )
      return matchCategory && matchSearch && matchDietary
    })
  }, [menuItems, selectedCategory, searchQuery, selectedDietary])

  const getItemCartQuantity = (itemId: string) => {
    const found = cart.find((c) => c.item.id === itemId)
    return found ? found.quantity : 0
  }

  return (
    <div className="w-full space-y-8 pb-32">
      {/* Late-Night Special Feature Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-950/80 via-slate-900 to-amber-950/60 border border-red-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="pointer-events-none absolute -right-10 -bottom-10 w-48 h-48 bg-red-600/20 blur-3xl rounded-full" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-950/90 border border-red-500/40 text-red-300 text-xs font-semibold">
              <Moon className="w-3.5 h-3.5 text-amber-400" />
              <span>Continuous Room Tab Enabled</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Late-Night Bites &amp; Dining
            </h2>
            <p className="text-slate-300 text-sm max-w-xl">
              Order appetizers, entrees, or midnight cravings anytime. All items seamlessly append to your <strong>{locationName}</strong> continuous tab.
            </p>
          </div>

          <button
            onClick={() => setSelectedCategory('Late-Night Bites')}
            className="self-start md:self-auto px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-red-950/50 transition-colors cursor-pointer"
          >
            <Flame className="w-4 h-4 text-amber-300 fill-amber-300" />
            <span>View Late-Night Snacks</span>
          </button>
        </div>
      </div>

      {/* Category Pills & Search Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dumplings, cocktails, wagyu..."
              className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-red-500/60"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            )}
          </div>

          {/* Dietary Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {['Spicy', 'Vegan', 'Late Night'].map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  setSelectedDietary((prev) => (prev === tag ? null : tag))
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                  selectedDietary === tag
                    ? 'bg-red-600/30 border-red-500 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tag === 'Spicy' && '🌶️ '}
                {tag === 'Vegan' && '🌱 '}
                {tag === 'Late Night' && '🌙 '}
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg shadow-red-950/60'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          const qty = getItemCartQuantity(item.id)
          return (
            <motion.div
              layout
              key={item.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 rounded-3xl p-5 flex flex-col justify-between backdrop-blur-sm shadow-lg hover:shadow-red-950/20 transition-all group"
            >
              <div className="space-y-3">
                {/* Header & Tags */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {item.isLateNight && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                        <Moon className="w-3 h-3 text-amber-400" />
                        Late-Night
                      </span>
                    )}
                    {item.dietaryTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700 text-slate-300 text-[10px] font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <span className="font-mono text-base font-extrabold text-red-400">
                    ₹{item.price.toFixed(2)}
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-red-400 transition-colors">
                    {item.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-5 mt-4 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">
                  {item.category}
                </span>

                {qty > 0 ? (
                  <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl p-1">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-200"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-mono font-bold text-xs text-white">
                      {qty}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-7 h-7 rounded-lg bg-red-600 hover:bg-red-500 flex items-center justify-center text-white"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(item)}
                    className="px-3.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600 border border-red-500/40 hover:border-red-500 text-red-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Tab</span>
                  </button>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
