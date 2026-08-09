import { Link, useLocation } from 'react-router-dom';

export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-black text-emerald-300 font-display flex items-center justify-center px-4">
      <div className="max-w-2xl w-full border border-emerald-700/60 rounded-md p-8 space-y-6 text-center">
        <div className="text-emerald-500 text-xs tracking-widest">[ TRANSMISSION LOST ]</div>
        <h1 className="text-3xl text-emerald-300 leading-tight">404 / SIGNAL NOT FOUND</h1>
        <p className="text-emerald-400/80 text-xs leading-relaxed">
          Path <code className="text-emerald-200 break-all">{pathname}</code> is not on the channel
          matrix.
          <br />
          Possible scrambled coordinates. Recommend retrace to base.
        </p>
        <div className="flex justify-center pt-4">
          <Link
            to="/"
            className="border border-emerald-500 text-emerald-300 px-4 py-2 text-xs hover:bg-emerald-900/40 transition-colors"
          >
            [ RETURN TO HUB ]
          </Link>
        </div>
      </div>
    </div>
  );
}
