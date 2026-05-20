import { useState, useEffect } from 'react';
import { Search, Plus, Save, Trash2, Upload, X } from 'lucide-react';

const { ipcRenderer } = window.electron;

export default function Products() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', price: '', cost: '', stock: '', category: 'General', image_url: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    setLoading(true);
    try {
      const res = await ipcRenderer.invoke('db-query', `SELECT id, name, price, cost, stock, category, COALESCE(image_url, '') as image_url FROM "Product" ORDER BY name LIMIT 100`);
      setProducts(res.rows || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function openEdit(p = null) {
    setEditing(p);
    setForm(p ? { ...p } : { id: '', name: '', price: '', cost: '', stock: '', category: 'General', image_url: '' });
  }

  async function saveProduct() {
    if (!form.name) return alert('Name required');
    const id = form.id || `prod_${Date.now()}`;
    const isNew = !form.id;
    try {
      if (isNew) {
        await ipcRenderer.invoke('db-query', `INSERT INTO "Product" (id, name, price, cost, stock, category, image_url, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())`,
          [id, form.name, Number(form.price), Number(form.cost), Number(form.stock), form.category, form.image_url]);
      } else {
        await ipcRenderer.invoke('db-query', `UPDATE "Product" SET name=$1, price=$2, cost=$3, stock=$4, category=$5, image_url=$6, updated_at=NOW() WHERE id=$7`,
          [form.name, Number(form.price), Number(form.cost), Number(form.stock), form.category, form.image_url, form.id]);
      }
      openEdit(null);
      loadProducts();
    } catch (e) { alert('Save failed: ' + e.message); }
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return;
    try {
      await ipcRenderer.invoke('db-query', `DELETE FROM "Product" WHERE id=$1`, [id]);
      loadProducts();
    } catch (e) { alert('Delete failed: ' + e.message); }
  }

  function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({ ...f, image_url: ev.target.result }));
    reader.readAsDataURL(file);
  }

  const filtered = products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar List */}
      <div className="w-1/3 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold">Products</h2>
          <button onClick={() => openEdit()} className="bg-blue-600 hover:bg-blue-500 p-2 rounded"><Plus size={18} /></button>
        </div>
        <div className="p-2">
          <div className="flex items-center bg-gray-800 rounded px-2">
            <Search size={16} className="text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full p-2 bg-transparent outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? <p className="p-4 text-gray-500">Loading...</p> :
          filtered.map(p => (
            <div key={p.id} onClick={() => openEdit(p)} className="p-3 border-b border-gray-700 hover:bg-gray-800 cursor-pointer flex justify-between">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-gray-400">Rs. {p.price} | Stock: {p.stock}</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteProduct(p.id); }} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Form */}
      <div className="flex-1 p-6 overflow-y-auto">
        {editing !== null ? (
          <div className="max-w-lg mx-auto bg-gray-800 p-6 rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">{form.id ? 'Edit Product' : 'New Product'}</h3>
              <button onClick={() => openEdit(null)}><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Product Name" className="w-full p-2 bg-gray-700 rounded" />
              <div className="grid grid-cols-2 gap-4">
                <input value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))} placeholder="Price (Rs.)" type="number" className="p-2 bg-gray-700 rounded" />
                <input value={form.cost} onChange={e => setForm(f => ({...f, cost: e.target.value}))} placeholder="Cost (Rs.)" type="number" className="p-2 bg-gray-700 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input value={form.stock} onChange={e => setForm(f => ({...f, stock: e.target.value}))} placeholder="Stock" type="number" className="p-2 bg-gray-700 rounded" />
                <input value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))} placeholder="Category" className="p-2 bg-gray-700 rounded" />
              </div>
              
              {/* Image Upload */}
              <div className="border-2 border-dashed border-gray-600 rounded p-4 text-center hover:border-blue-500 transition">
                {form.image_url ? (
                  <div className="relative">
                    <img src={form.image_url} alt="Preview" className="max-h-40 mx-auto rounded" />
                    <button onClick={() => setForm(f => ({...f, image_url: ''}))} className="absolute top-0 right-0 bg-red-600 rounded-full p-1"><X size={14} /></button>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center">
                    <Upload size={24} className="text-gray-400 mb-2" />
                    <span className="text-sm text-gray-400">Click to upload image</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                )}
              </div>

              <button onClick={saveProduct} className="w-full bg-green-600 hover:bg-green-500 p-2 rounded flex justify-center items-center gap-2"><Save size={18} /> Save Product</button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">Select a product or add new</div>
        )}
      </div>
    </div>
  );
}
