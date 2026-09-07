import { useState } from 'react';
import { useWishlist } from '../../context/WishlistContext';
import { Folder, Plus, MoreVertical, Edit2, Globe, Lock, Trash2, Eye } from 'lucide-react';
import ProductCard from '../../components/product/ProductCard';
import Input from '../../components/ui/Input';
import Checkbox from '../../components/ui/Checkbox';
import './DashboardProducts.css';

export default function DashboardCollections() {
  const { collections, createCollection, deleteCollection, updateCollection, removeItemFromCollection } = useWishlist();
  const [isCreating, setIsCreating] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColPublic, setNewColPublic] = useState(false);
  
  const [selectedCol, setSelectedCol] = useState(collections[0]?.id || 'default');
  
  const handleCreate = (e) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    createCollection(newColName, newColPublic);
    setNewColName('');
    setNewColPublic(false);
    setIsCreating(false);
  };

  const activeCol = collections.find(c => c.id === selectedCol) || collections[0];

  return (
    <div className="dashboard-products">
      <div className="mb-2xl flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold mb-xs">Your Collections</h2>
          <p className="text-muted text-sm">Organize your saved assets into custom folders.</p>
        </div>
        <button className="btn btn-primary flex-center gap-sm" onClick={() => setIsCreating(true)}>
          <Plus size={16} /> New Collection
        </button>
      </div>

      {isCreating && (
        <div className="glass-card p-xl mb-xl">
          <h3 className="font-bold mb-md">Create New Collection</h3>
          <form onSubmit={handleCreate} className="flex items-end gap-md">
            <div className="flex-1 mb-0">
              <Input
                label="Collection Name"
                placeholder="e.g. Next Project Ideas"
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                autoFocus
                size="md"
              />
            </div>
            <div className="mb-0 flex items-center h-[56px]">
              <Checkbox
                label="Make Public"
                checked={newColPublic}
                onChange={(e) => setNewColPublic(e.target.checked)}
              />
            </div>
            <button type="submit" className="btn btn-primary h-full">Create</button>
            <button type="button" className="btn btn-outline h-full" onClick={() => setIsCreating(false)}>Cancel</button>
          </form>
        </div>
      )}

      <div className="grid-2-cols" style={{ gridTemplateColumns: '250px 1fr', gap: 'var(--space-8)', alignItems: 'start' }}>
        
        {/* Sidebar Collections List */}
        <div className="glass-card p-md flex flex-col gap-xs">
          {collections.map(col => (
            <button
              key={col.id}
              className={`flex justify-between items-center px-md py-sm rounded-md transition-colors ${
                selectedCol === col.id ? 'bg-accent text-white' : 'text-secondary hover:bg-secondary'
              }`}
              onClick={() => setSelectedCol(col.id)}
            >
              <div className="flex items-center gap-sm">
                <Folder size={16} fill={selectedCol === col.id ? 'currentColor' : 'none'} />
                <span className="font-medium text-sm truncate max-w-[120px]">{col.name}</span>
              </div>
              <span className="text-xs font-semibold opacity-80">{col.items.length}</span>
            </button>
          ))}
        </div>

        {/* Selected Collection Content */}
        {activeCol && (
          <div className="glass-card p-xl min-h-[400px]">
            <div className="flex justify-between items-center mb-xl pb-md border-b">
              <div>
                <h3 className="text-2xl font-bold flex items-center gap-sm">
                  {activeCol.name}
                  {activeCol.isPublic ? <Globe size={18} className="text-muted" /> : <Lock size={18} className="text-muted" />}
                </h3>
                <p className="text-muted text-sm mt-xs">
                  {activeCol.items.length} items • {activeCol.isPublic ? 'Public collection' : 'Private collection'}
                </p>
              </div>
              
              <div className="flex gap-sm">
                <button 
                  className="btn btn-outline flex-center gap-xs text-sm"
                  onClick={() => updateCollection(activeCol.id, { isPublic: !activeCol.isPublic })}
                >
                  {activeCol.isPublic ? <><Lock size={14} /> Make Private</> : <><Globe size={14} /> Make Public</>}
                </button>
                {activeCol.id !== 'default' && (
                  <button 
                    className="btn btn-outline flex-center gap-xs text-danger border-danger text-sm"
                    onClick={() => {
                      deleteCollection(activeCol.id);
                      setSelectedCol('default');
                    }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
            </div>

            {activeCol.items.length > 0 ? (
              <div className="products-grid">
                {activeCol.items.map(product => (
                  <div key={product.id} className="relative group">
                    <ProductCard product={product} />
                    <button 
                      className="absolute top-2 right-2 bg-danger text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-10"
                      onClick={() => removeItemFromCollection(activeCol.id, product.id)}
                      title="Remove from collection"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4xl text-center">
                <Folder size={48} className="text-muted mb-md opacity-50" />
                <h4 className="text-lg font-bold mb-xs">This collection is empty</h4>
                <p className="text-muted">Browse the marketplace and save products here.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
