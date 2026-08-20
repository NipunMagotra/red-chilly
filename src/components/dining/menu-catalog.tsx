'use client'

import { useState, useMemo } from 'react'
import {
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

export function MenuCatalog({ menuItems }: MenuCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedDietary, setSelectedDietary] = useState<string | null>(null)

  const { cart, addToCart, updateQuantity } = useDineScanStore()

  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(menuItems.map((it) => it.category)))]
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
    <div className="w-full space-y-5 pb-24">
      {/* Category Tabs & Search Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu items..."
              className="w-full bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Dietary Filter */}
          <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
            {['Vegetarian', 'Gluten-Free', 'Spicy'].map((tag) => (
              <button
                key={tag}
                onClick={() =>
                  setSelectedDietary(selectedDietary === tag ? null : tag)
                }
                className={`px-2 py-1 rounded border transition-colors cursor-pointer ${
                  selectedDietary === tag
                    ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium'
                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Category Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-slate-200">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 border border-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Item Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredItems.map((item) => {
          const qty = getItemCartQuantity(item.id)
          return (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-md p-3.5 flex flex-col justify-between text-left shadow-2xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-xs text-slate-900">
                    {item.name}
                  </h3>
                  <span className="font-mono font-bold text-xs text-slate-900 whitespace-nowrap">
                    ₹{item.price.toFixed(2)}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed line-clamp-2">
                  {item.description}
                </p>

                {item.dietaryTags.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    {item.dietaryTags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] text-slate-500 font-mono bg-slate-50 px-1 py-0.5 rounded border border-slate-100"
                      >
                        [{tag}]
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button / Quantity Selector */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">
                  {item.category}
                </span>

                {qty > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.id, qty - 1)}
                      className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-700 text-xs cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold text-xs text-slate-900 min-w-[16px] text-center">
                      {qty}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, qty + 1)}
                      className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-700 text-xs cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(item)}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {filteredItems.length === 0 && (
        <div className="p-8 text-center text-slate-400 text-xs">
          No menu items found matching your filters.
        </div>
      )}
    </div>
  )
}
