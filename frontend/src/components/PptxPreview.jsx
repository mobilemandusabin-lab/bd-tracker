import { useMemo } from 'react';

const SLIDE_COLORS = {
  'Business Development': { bg: 'from-red-50 to-white', border: 'border-red-200', header: 'bg-red-600', text: 'text-red-600' },
  'Listing': { bg: 'from-blue-50 to-white', border: 'border-blue-200', header: 'bg-blue-600', text: 'text-blue-600' },
  'Quality Control': { bg: 'from-emerald-50 to-white', border: 'border-emerald-200', header: 'bg-emerald-600', text: 'text-emerald-600' },
  'cover': { bg: 'from-slate-50 to-white', border: 'border-slate-200', header: 'bg-slate-900', text: 'text-slate-900' },
  'kpi': { bg: 'from-amber-50 to-white', border: 'border-amber-200', header: 'bg-amber-600', text: 'text-amber-600' },
};

function formatVal(v) {
  if (v === null || v === undefined) return '—';
  return Number(v).toLocaleString();
}

function BarChart({ values, labels, title, maxVal }) {
  if (!values || values.length === 0) return null;
  const mx = maxVal || Math.max(...values, 1);
  const barColors = ['#94A3B8', '#DC2626', '#FCA5A5'];
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">{title}</p>
      <div className="flex items-end gap-2 h-24">
        {values.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-slate-700">{formatVal(v)}</span>
            <div
              className="w-full rounded-t transition-all duration-300"
              style={{
                height: `${Math.max((v / mx) * 100, 2)}%`,
                backgroundColor: barColors[i] || barColors[0],
                minHeight: v > 0 ? '4px' : '2px',
                opacity: v > 0 ? 1 : 0.3,
              }}
            />
            <span className="text-[8px] text-slate-400 text-center leading-tight">{labels?.[i] || ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataTable({ values }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-1.5 pr-3 font-bold text-slate-400 uppercase tracking-wider">Metric</th>
            <th className="text-right py-1.5 px-2 font-bold text-slate-400 uppercase tracking-wider">Previous</th>
            <th className="text-right py-1.5 px-2 font-bold text-slate-800 uppercase tracking-wider bg-red-50">Current</th>
            <th className="text-right py-1.5 pl-2 font-bold text-amber-600 uppercase tracking-wider">Target</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {values.map((v, i) => (
            <tr key={i}>
              <td className="py-1.5 pr-3 font-semibold text-slate-700">{v.headingName}</td>
              <td className="py-1.5 px-2 text-right font-medium text-slate-400">{formatVal(v.previousValue)}</td>
              <td className="py-1.5 px-2 text-right font-bold text-slate-900 bg-red-50/50">{formatVal(v.currentValue)}</td>
              <td className="py-1.5 pl-2 text-right font-bold text-amber-600">{formatVal(v.targetValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getSection(sections, name) {
  return sections.find(s => s.departmentName?.toLowerCase().includes(name.toLowerCase().split(' ')[0]));
}

function getVal(section, key, field) {
  if (!section) return null;
  const v = section.values?.find(x => x.headingKey === key);
  return v ? v[field] : null;
}

function SlideCard({ number, title, subtitle, children, theme, noPadding }) {
  const c = SLIDE_COLORS[theme] || SLIDE_COLORS.cover;
  return (
    <div className={`bg-gradient-to-br ${c.bg} border ${c.border} rounded-2xl shadow-sm overflow-hidden`}>
      <div className={`${c.header} px-4 py-2 flex items-center justify-between`}>
        <div>
          <span className="text-[10px] font-bold text-white/70">Slide {number}</span>
          <h3 className="text-sm font-extrabold text-white">{title}</h3>
          {subtitle && <p className="text-[10px] text-white/60">{subtitle}</p>}
        </div>
        <span className="text-[10px] font-bold text-white/40">{number}/12</span>
      </div>
      <div className={noPadding ? '' : 'p-4'}>
        {children}
      </div>
    </div>
  );
}

export default function PptxPreview({ sections = [], summary = {} }) {
  const slides = useMemo(() => {
    const bd = getSection(sections, 'Business Development');
    const listing = getSection(sections, 'Listing');
    const qc = getSection(sections, 'Quality Control');

    return [
      {
        number: 1, title: 'Business Development', subtitle: 'Previous Week · Current Status · Next Week Target',
        theme: 'Business Development',
        render: () => <DataTable values={bd?.values || []} />,
      },
      {
        number: 2, title: 'BD Progress Charts', subtitle: 'Total Vendors · Total Verified Vendors',
        theme: 'Business Development',
        render: () => (
          <div className="grid grid-cols-2 gap-4">
            <BarChart
              values={[getVal(bd, 'totalVendors', 'previousValue'), getVal(bd, 'totalVendors', 'currentValue'), getVal(bd, 'totalVendors', 'targetValue')]}
              labels={['Prev', 'Current', 'Target']}
              title="Total Vendors"
            />
            <BarChart
              values={[getVal(bd, 'verifiedVendors', 'previousValue'), getVal(bd, 'verifiedVendors', 'currentValue'), getVal(bd, 'verifiedVendors', 'targetValue')]}
              labels={['Prev', 'Current', 'Target']}
              title="Total Verified Vendors"
            />
          </div>
        ),
      },
      {
        number: 3, title: 'BD Narrative', subtitle: 'Business Development Report',
        theme: 'Business Development',
        render: () => (
          <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
            {bd?.notes ? bd.notes.split('\n').filter(Boolean).map((l, i) => (
              <p key={i} className="mb-1">• {l}</p>
            )) : <p className="text-slate-300 italic">No notes</p>}
          </div>
        ),
      },
      {
        number: 4, title: 'Listing', subtitle: 'Previous Week · Current Status · Next Week Target',
        theme: 'Listing',
        render: () => <DataTable values={listing?.values || []} />,
      },
      {
        number: 5, title: 'Listing Charts', subtitle: 'Marketplace Products · Specifications Added',
        theme: 'Listing',
        render: () => (
          <div className="grid grid-cols-2 gap-4">
            <BarChart
              values={[getVal(listing, 'totalMarketplaceProducts', 'previousValue'), getVal(listing, 'totalMarketplaceProducts', 'currentValue'), getVal(listing, 'totalMarketplaceProducts', 'targetValue')]}
              labels={['Prev', 'Current', 'Target']}
              title="Marketplace Products"
            />
            <BarChart
              values={[getVal(listing, 'totalSpecificationsAdded', 'previousValue'), getVal(listing, 'totalSpecificationsAdded', 'currentValue'), getVal(listing, 'totalSpecificationsAdded', 'targetValue')]}
              labels={['Prev', 'Current', 'Target']}
              title="Specifications Added"
            />
          </div>
        ),
      },
      {
        number: 6, title: 'Listing Narrative', subtitle: 'Listing Report',
        theme: 'Listing',
        render: () => (
          <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
            {listing?.notes ? listing.notes.split('\n').filter(Boolean).map((l, i) => (
              <p key={i} className="mb-1">• {l}</p>
            )) : <p className="text-slate-300 italic">No notes</p>}
          </div>
        ),
      },
      {
        number: 7, title: 'Quality Control', subtitle: 'Previous Week · Current Status · Next Week Target',
        theme: 'Quality Control',
        render: () => <DataTable values={qc?.values || []} />,
      },
      {
        number: 8, title: 'QC Charts', subtitle: 'Products Approved · Rejected · Pending',
        theme: 'Quality Control',
        render: () => (
          <div className="grid grid-cols-3 gap-3">
            {['productsApproved', 'productsRejected', 'productsPending'].map(key => (
              <BarChart
                key={key}
                values={[getVal(qc, key, 'previousValue'), getVal(qc, key, 'currentValue'), getVal(qc, key, 'targetValue')]}
                labels={['Prev', 'Current', 'Target']}
                title={key.replace('products', 'Products ').replace(/([A-Z])/g, ' $1').trim()}
              />
            ))}
          </div>
        ),
      },
      {
        number: 9, title: 'QC Narrative', subtitle: 'Quality Control Report',
        theme: 'Quality Control',
        render: () => (
          <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
            {qc?.notes ? qc.notes.split('\n').filter(Boolean).map((l, i) => (
              <p key={i} className="mb-1">• {l}</p>
            )) : <p className="text-slate-300 italic">No notes</p>}
          </div>
        ),
      },
      {
        number: 10, title: 'KPI Overview', subtitle: 'BD ·  Listing',
        theme: 'kpi',
        render: () => (
          <div className="grid grid-cols-2 gap-4">
            <BarChart
              values={[getVal(bd, 'totalVendors', 'previousValue'), getVal(bd, 'totalVendors', 'currentValue'), getVal(bd, 'totalVendors', 'targetValue')]}
              labels={['Prev', 'Current', 'Target']}
              title="BD KPI — Total Vendors"
            />
            <BarChart
              values={[getVal(listing, 'totalMarketplaceProducts', 'previousValue'), getVal(listing, 'totalMarketplaceProducts', 'currentValue'), getVal(listing, 'totalMarketplaceProducts', 'targetValue')]}
              labels={['Prev', 'Current', 'Target']}
              title="Listing — Marketplace Products"
            />
          </div>
        ),
      },
      {
        number: 11, title: 'Report Closure', subtitle: 'Summary',
        theme: 'cover',
        render: () => (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Vendors', key: 'totalVendors' },
              { label: 'Total Marketplace Products', key: 'totalMarketplaceProducts' },
              { label: 'Daily Average Listings', key: 'dailyAverageListings' },
            ].map(item => (
              <div key={item.key} className="text-center p-3 bg-white rounded-xl border border-slate-100">
                <p className="text-2xl font-extrabold text-slate-900">{formatVal(summary?.[item.key] ?? getVal(bd, item.key, 'currentValue') ?? getVal(listing, item.key, 'currentValue'))}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        ),
      },
    ];
  }, [sections, summary]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-slate-900">Live PPTX Preview</h2>
        <span className="text-[10px] text-slate-400">{slides.length} slides</span>
      </div>
      <div className="space-y-3">
        {slides.map(slide => (
          <SlideCard key={slide.number} {...slide}>
            {slide.render()}
          </SlideCard>
        ))}
      </div>
    </div>
  );
}
