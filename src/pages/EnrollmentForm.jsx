import { useState } from 'react';
import { TENANTS, getEnrollmentConfig, getFormSchema } from '../lib/tenantStore';

/* ── Step config — generic (school picker included) ─────────── */
const STEPS_GENERIC = [
  { id: 'school',   label: 'School',   icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { id: 'student',  label: 'Student',  icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { id: 'parent',   label: 'Parent',   icon: 'M20 21v-2a4 4 0 00-4-4h-4M14 11a4 4 0 10-8 0 4 4 0 008 0zM1 21v-2a4 4 0 014-4h.5' },
  { id: 'academic', label: 'Academic', icon: 'M12 14l9-5-9-5-9 5 9 5z' },
  { id: 'review',   label: 'Review',   icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
];

/* ── Steps when school is pre-selected (4 steps, no school picker) */
const STEPS_SCHOOL = [
  { id: 'student',  label: 'Student',  icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { id: 'parent',   label: 'Parent',   icon: 'M20 21v-2a4 4 0 00-4-4h-4M14 11a4 4 0 10-8 0 4 4 0 008 0zM1 21v-2a4 4 0 014-4h.5' },
  { id: 'academic', label: 'Academic', icon: 'M12 14l9-5-9-5-9 5 9 5z' },
  { id: 'review',   label: 'Review',   icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
];

const ALL_CLASSES = [
  'P.1','P.2','P.3','P.4','P.5','P.6','P.7',
  'S.1 East','S.1 West','S.2 East','S.2 West',
  'S.3 East','S.3 West','S.4 East','S.4 West',
  'S.5 Arts','S.5 Science','S.6 Arts','S.6 Science',
];
const GENDERS       = ['Male','Female'];
const NATIONALITIES = ['Ugandan','Kenyan','Tanzanian','Rwandese','Congolese','Other'];
const RELATIONSHIPS = ['Father','Mother','Guardian','Uncle','Aunt','Other'];
const RELIGIONS     = ['Christian','Muslim','Other'];

/* ── Input helpers ─────────────────────────────────────────── */
function Field({ label, required, error, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint  && !error && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

const inputCls = (err) =>
  `w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all focus:ring-2 focus:ring-[#1E45FC]/20 ${
    err ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white focus:border-[#1E45FC]'
  }`;

const selectCls = (err) =>
  `w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none appearance-none bg-white transition-all focus:ring-2 focus:ring-[#1E45FC]/20 ${
    err ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-[#1E45FC]'
  }`;

/* ── Render a single schema-driven field ────────────────────── */
function SchemaField({ field, form, set, clearErr, errors, intakeClasses, intakeTerms, themeColor }) {
  const { id, label, type, required } = field;
  const err = errors[id];

  if (type === 'class_select') {
    // reuse for both entry_class (application) and last_class (academic)
    const options = id === 'entry_class' ? intakeClasses : ALL_CLASSES;
    return (
      <Field label={label} required={required} error={err}>
        <select value={form[id] ?? ''} onChange={e => { set(id, e.target.value); clearErr(id); }} className={selectCls(err)}>
          <option value="">— Select class —</option>
          {options.map(c => <option key={c}>{c}</option>)}
        </select>
      </Field>
    );
  }
  if (type === 'term_select') return (
    <Field label={label} required={required} error={err}>
      <select value={form[id] ?? ''} onChange={e => { set(id, e.target.value); clearErr(id); }} className={selectCls(err)}>
        {intakeTerms.map(t => <option key={t}>{t}</option>)}
      </select>
    </Field>
  );
  if (type === 'boarding_pick') return (
    <Field label={label}>
      <div className="grid grid-cols-2 gap-3">
        {[{ v:'day_scholar', label:'Day Scholar' }, { v:'boarding', label:'Boarding' }].map(o => (
          <button key={o.v} type="button" onClick={() => set('boarding', o.v)}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all"
            style={form.boarding === o.v ? { borderColor: themeColor, background: themeColor + '10', color: themeColor } : { borderColor:'#e2e8f0', color:'#64748b' }}>
            {form.boarding === o.v && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
  if (type === 'gender_select') return (
    <Field label={label} required={required} error={err}>
      <select value={form[id] ?? ''} onChange={e => { set(id, e.target.value); clearErr(id); }} className={selectCls(err)}>
        <option value="">— Select —</option>
        {GENDERS.map(g => <option key={g}>{g}</option>)}
      </select>
    </Field>
  );
  if (type === 'nationality_select') return (
    <Field label={label} required={required} error={err}>
      <select value={form[id] ?? ''} onChange={e => set(id, e.target.value)} className={selectCls()}>
        {NATIONALITIES.map(n => <option key={n}>{n}</option>)}
      </select>
    </Field>
  );
  if (type === 'religion_select') return (
    <Field label={label} required={required} error={err}>
      <select value={form[id] ?? ''} onChange={e => set(id, e.target.value)} className={selectCls()}>
        <option value="">— Select —</option>
        {RELIGIONS.map(r => <option key={r}>{r}</option>)}
      </select>
    </Field>
  );
  if (type === 'relationship_select') return (
    <Field label={label} required={required} error={err}>
      <select value={form[id] ?? ''} onChange={e => { set(id, e.target.value); clearErr(id); }} className={selectCls(err)}>
        <option value="">— Select —</option>
        {RELATIONSHIPS.map(r => <option key={r}>{r}</option>)}
      </select>
    </Field>
  );
  if (type === 'textarea') return (
    <Field label={label} required={required} error={err}>
      <textarea value={form[id] ?? ''} onChange={e => { set(id, e.target.value); if (required) clearErr(id); }}
        rows={3} placeholder={`Enter ${label.toLowerCase()}…`}
        className={inputCls(err) + ' resize-none'} />
    </Field>
  );
  if (type === 'checkbox') return null; // handled separately in documents section
  // Default: text / tel / email / date
  return (
    <Field label={label} required={required} error={err}>
      <input type={type === 'tel' ? 'tel' : type === 'email' ? 'email' : type === 'date' ? 'date' : 'text'}
        value={form[id] ?? ''} onChange={e => { set(id, e.target.value); if (required) clearErr(id); }}
        placeholder={type === 'tel' ? '+256 700 000 000' : type === 'email' ? 'email@example.com' : `Enter ${label.toLowerCase()}`}
        className={inputCls(err)} />
    </Field>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export default function EnrollmentForm({ schoolId: presetSchoolId = null, onBack }) {
  /* Determine mode */
  const isSchoolMode = !!presetSchoolId;
  const STEPS = isSchoolMode ? STEPS_SCHOOL : STEPS_GENERIC;

  const presetSchool  = presetSchoolId ? TENANTS[presetSchoolId] : null;
  const presetConfig  = presetSchoolId ? getEnrollmentConfig(presetSchoolId) : null;
  const themeColor    = presetConfig?.themeColor ?? '#1E45FC';

  /* Load form schema — tenant-customised or defaults */
  const schema       = getFormSchema(presetSchoolId);
  const schemaFor    = (section) => schema.filter(f => f.section === section && f.enabled);

  const allSchools   = Object.values(TENANTS).filter(t => t.status === 'active' || t.status === 'trial');
  const defaultTerm  = (presetConfig?.intakeTerms ?? ['Term 2 2026'])[0];

  const [step, setStep]       = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [refNumber] = useState(() => 'ENR-' + Math.random().toString(36).slice(2,8).toUpperCase());
  const [errors, setErrors]   = useState({});

  /* Build initial form state from schema + hardcoded defaults */
  const [form, setForm] = useState(() => {
    const base = {
      school_id:    presetSchoolId ?? '',
      entry_class:  '',
      entry_term:   defaultTerm,
      boarding:     'day_scholar',
      nationality:  'Ugandan',
      docs_passport: false,
      docs_birth:    false,
      docs_reports:  false,
      docs_transfer: false,
      agree:         false,
    };
    // Initialise all schema fields that are not already in base
    schema.forEach(f => {
      if (!(f.id in base)) {
        base[f.id] = f.type === 'checkbox' ? false : '';
      }
    });
    return base;
  });

  const set      = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const clearErr = (k)    => setErrors(e => { const n = { ...e }; delete n[k]; return n; });

  /* Derive selected school & config for the form */
  const currentSchoolId = isSchoolMode ? presetSchoolId : form.school_id;
  const selectedSchool  = currentSchoolId ? TENANTS[currentSchoolId] : null;
  const selectedConfig  = currentSchoolId ? getEnrollmentConfig(currentSchoolId) : null;
  const intakeClasses   = selectedConfig?.intakeClasses ?? ALL_CLASSES;
  const intakeTerms     = selectedConfig?.intakeTerms   ?? ['Term 1 2026','Term 2 2026','Term 3 2026'];
  const needsTransfer   = selectedConfig?.requiresTransferLetter ?? true;

  /* Map step index to step ID (handles generic vs school mode) */
  const currentStepId = STEPS[step]?.id;

  /* Schema-driven validation per step */
  const validate = (s) => {
    const id = STEPS[s]?.id;
    const e = {};
    if (id === 'school') {
      if (!form.school_id)   e.school_id   = 'Please select a school.';
      if (!form.entry_class) e.entry_class = 'Please select the class.';
      if (!form.entry_term)  e.entry_term  = 'Please select entry term.';
    }
    // For student / parent / academic: validate required schema fields
    const sectionMap = { student: ['application','student'], parent: ['parent'], academic: ['academic'] };
    if (sectionMap[id]) {
      sectionMap[id].forEach(sec => {
        schemaFor(sec).forEach(field => {
          if (!field.required) return;
          const val = form[field.id];
          if (field.type === 'checkbox') return; // doc checkboxes are not required-validated
          if (val === undefined || val === null || String(val).trim() === '') {
            e[field.id] = `${field.label} is required.`;
          }
          if (field.type === 'email' && val && !String(val).includes('@')) {
            e[field.id] = 'Enter a valid email address.';
          }
        });
      });
      // entry_class required check in school mode
      if (id === 'student' && isSchoolMode && !form.entry_class) {
        e.entry_class = 'Please select the class applying for.';
      }
    }
    if (id === 'academic') {
      if (!form.agree) e.agree = 'You must agree to continue.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next   = ()  => { if (validate(step)) setStep(s => s + 1); };
  const back   = ()  => { setStep(s => s - 1); setErrors({}); };
  const submit = ()  => { if (validate(step)) setSubmitted(true); };

  /* ── Submitted screen ── */
  if (submitted) {
    return (
      <Shell school={selectedSchool} config={selectedConfig} themeColor={themeColor} onBack={onBack}>
        <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
          {/* Success icon */}
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
            style={{ background: themeColor + '18', border: `2px solid ${themeColor}30` }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={themeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>
            </svg>
          </div>
          <h2 className="text-2xl font-extrabold mb-2" style={{ color: '#0B0F2A', fontFamily: 'Fraunces, serif' }}>
            Application Submitted!
          </h2>
          <p className="text-gray-500 text-sm mb-6 max-w-sm leading-relaxed">
            Thank you! Your enrollment application for <strong>{form.first_name} {form.last_name}</strong> has been received by <strong>{selectedSchool?.name}</strong>.
          </p>

          {/* Reference card */}
          <div className="w-full max-w-sm rounded-2xl border-2 border-dashed p-5 mb-6 text-left"
            style={{ borderColor: themeColor + '40', background: themeColor + '06' }}>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Reference Number</p>
            <p className="text-2xl font-extrabold tracking-widest mb-4" style={{ color: themeColor }}>{refNumber}</p>
            <div className="space-y-2 text-xs text-gray-600">
              {[
                ['Student',    `${form.first_name} ${form.last_name}`],
                ['School',     selectedSchool?.name ?? '—'],
                ['Class',      form.entry_class || '—'],
                ['Entry Term', form.entry_term],
                ['Residence',  form.boarding === 'boarding' ? 'Boarding' : 'Day Scholar'],
                ['Status',     'Pending Review'],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between border-b border-dashed pb-1.5" style={{ borderColor: themeColor + '25' }}>
                  <span className="text-gray-400">{l}</span>
                  <span className={`font-semibold ${l === 'Status' ? 'text-yellow-600' : ''}`} style={{ color: l === 'Status' ? undefined : '#0B0F2A' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedConfig?.contact && (
            <div className="w-full max-w-sm rounded-xl p-3 mb-5 text-xs text-center" style={{ background: '#f8faff', border: '1px solid #eef0f6' }}>
              <p className="text-gray-400 mb-1">The school will contact you at <strong>{form.parent_phone}</strong></p>
              <p className="text-gray-400">or via admissions: <strong style={{ color: themeColor }}>{selectedConfig.contact.email}</strong></p>
            </div>
          )}

          <div className="flex gap-3 w-full max-w-sm">
            <button onClick={() => window.print()}
              className="flex-1 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2"
              style={{ borderColor: '#e2e8f0' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              Print
            </button>
            <button onClick={onBack} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: themeColor }}>
              Back to Login
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell school={selectedSchool} config={selectedConfig} themeColor={themeColor} onBack={onBack}>
      {/* ── Stepper ── */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1">
              <button
                onClick={() => i < step && setStep(i)}
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${i < step ? 'cursor-pointer' : 'cursor-default'}`}
                style={{
                  background: i < step ? themeColor : i === step ? '#0B0F2A' : '#f1f5f9',
                  color:      i <= step ? 'white' : '#94a3b8',
                  border:     i === step ? `2px solid ${themeColor}` : 'none',
                }}>
                {i < step ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={s.icon}/>
                  </svg>
                )}
              </button>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-1" style={{ background: i < step ? themeColor : '#e2e8f0' }} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider">
          {STEPS.map((s, i) => (
            <span key={s.id} className="w-8 text-center" style={{ color: i === step ? themeColor : i < step ? '#0B0F2A' : '#94a3b8' }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Form body ── */}
      <div className="px-6 pb-6 pt-4">

        {/* ─ Step: School selection (generic mode only) ─ */}
        {currentStepId === 'school' && (
          <StepSection title="Select School" subtitle="Choose the school and class you are applying for.">
            <Field label="School" required error={errors.school_id}>
              <select value={form.school_id} onChange={e => { set('school_id', e.target.value); set('entry_class', ''); clearErr('school_id'); }} className={selectCls(errors.school_id)}>
                <option value="">— Select a school —</option>
                {allSchools.map(s => {
                  const cfg = getEnrollmentConfig(s.school_id);
                  const open = cfg?.open !== false;
                  return (
                    <option key={s.school_id} value={s.school_id} disabled={!open}>
                      {s.name} ({s.district}){!open ? ' — Closed' : ''}
                    </option>
                  );
                })}
              </select>
            </Field>

            {selectedSchool && (
              <SchoolInfoCard school={selectedSchool} config={selectedConfig} themeColor={themeColor} />
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Applying for Class" required error={errors.entry_class}>
                <select value={form.entry_class} onChange={e => { set('entry_class', e.target.value); clearErr('entry_class'); }} className={selectCls(errors.entry_class)}>
                  <option value="">— Select class —</option>
                  {(selectedConfig?.intakeClasses ?? ALL_CLASSES).map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Entry Term" required error={errors.entry_term}>
                <select value={form.entry_term} onChange={e => { set('entry_term', e.target.value); clearErr('entry_term'); }} className={selectCls(errors.entry_term)}>
                  {(selectedConfig?.intakeTerms ?? ['Term 1 2026','Term 2 2026','Term 3 2026']).map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Residence Type">
              <div className="grid grid-cols-2 gap-3">
                {[{ v:'day_scholar', label:'Day Scholar' }, { v:'boarding', label:'Boarding' }].map(o => (
                  <button key={o.v} type="button" onClick={() => set('boarding', o.v)}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all"
                    style={form.boarding === o.v ? { borderColor: themeColor, background: themeColor + '10', color: themeColor } : { borderColor:'#e2e8f0', color:'#64748b' }}>
                    {form.boarding === o.v && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>

            {selectedConfig?.fees && form.boarding && (
              <FeeTable fees={selectedConfig.fees} boarding={form.boarding} themeColor={themeColor} />
            )}
          </StepSection>
        )}

        {/* ─ Step: Student (school mode also collects class + term here) ─ */}
        {currentStepId === 'student' && (
          <StepSection title="Student Information" subtitle="Enter the student's personal details accurately.">
            {/* School-mode: school badge */}
            {isSchoolMode && (
              <div className="rounded-xl p-3 mb-1 flex items-center gap-3" style={{ background: themeColor + '08', border: `1px solid ${themeColor}22` }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-xs text-white flex-shrink-0" style={{ background: themeColor }}>
                  {selectedSchool?.logo_initials}
                </div>
                <div>
                  <div className="text-xs font-bold" style={{ color: '#0B0F2A' }}>{selectedSchool?.name}</div>
                  <div className="text-[10px] text-gray-400">{selectedSchool?.district} · Enrollment Application</div>
                </div>
              </div>
            )}

            {/* School-mode: application fields (class/term/boarding) from schema */}
            {isSchoolMode && schemaFor('application').length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {schemaFor('application').map(field => (
                  <SchemaField key={field.id} field={field} form={form} set={set} clearErr={clearErr} errors={errors}
                    intakeClasses={intakeClasses} intakeTerms={intakeTerms} themeColor={themeColor} />
                ))}
              </div>
            )}

            {isSchoolMode && selectedConfig?.fees && (
              <FeeTable fees={selectedConfig.fees} boarding={form.boarding} themeColor={themeColor} />
            )}

            {/* Pair up student fields into 2-column rows where logical */}
            {(() => {
              const fields = schemaFor('student');
              // pair first_name+last_name and dob+gender, rest single
              const rendered = [];
              let i = 0;
              while (i < fields.length) {
                const f = fields[i];
                const next = fields[i + 1];
                const pairIds = [['first_name','last_name'],['dob','gender'],['nationality','religion']];
                const isPair = next && pairIds.some(p => p[0] === f.id && p[1] === next.id);
                if (isPair) {
                  rendered.push(
                    <div key={f.id + next.id} className="grid grid-cols-2 gap-4">
                      <SchemaField field={f}    form={form} set={set} clearErr={clearErr} errors={errors} intakeClasses={intakeClasses} intakeTerms={intakeTerms} themeColor={themeColor} />
                      <SchemaField field={next} form={form} set={set} clearErr={clearErr} errors={errors} intakeClasses={intakeClasses} intakeTerms={intakeTerms} themeColor={themeColor} />
                    </div>
                  );
                  i += 2;
                } else {
                  rendered.push(<SchemaField key={f.id} field={f} form={form} set={set} clearErr={clearErr} errors={errors} intakeClasses={intakeClasses} intakeTerms={intakeTerms} themeColor={themeColor} />);
                  i += 1;
                }
              }
              return rendered;
            })()}
          </StepSection>
        )}

        {/* ─ Step: Parent / Guardian ─ */}
        {currentStepId === 'parent' && (
          <StepSection title="Parent / Guardian" subtitle="Contact details for the student's parent or guardian.">
            {(() => {
              const fields = schemaFor('parent');
              const rendered = [];
              let i = 0;
              while (i < fields.length) {
                const f = fields[i];
                const next = fields[i + 1];
                const pairIds = [['parent_name','relationship'],['parent_phone','parent_phone2']];
                const isPair = next && pairIds.some(p => p[0] === f.id && p[1] === next.id);
                if (isPair) {
                  rendered.push(
                    <div key={f.id + next.id} className="grid grid-cols-2 gap-4">
                      <SchemaField field={f}    form={form} set={set} clearErr={clearErr} errors={errors} intakeClasses={intakeClasses} intakeTerms={intakeTerms} themeColor={themeColor} />
                      <SchemaField field={next} form={form} set={set} clearErr={clearErr} errors={errors} intakeClasses={intakeClasses} intakeTerms={intakeTerms} themeColor={themeColor} />
                    </div>
                  );
                  i += 2;
                } else {
                  rendered.push(<SchemaField key={f.id} field={f} form={form} set={set} clearErr={clearErr} errors={errors} intakeClasses={intakeClasses} intakeTerms={intakeTerms} themeColor={themeColor} />);
                  i += 1;
                }
              }
              return rendered;
            })()}
          </StepSection>
        )}

        {/* ─ Step: Academic history + Documents ─ */}
        {currentStepId === 'academic' && (
          <StepSection title="Academic & Documents" subtitle="Previous schooling and documentation checklist.">
            {/* Academic fields from schema */}
            {(() => {
              const fields = schemaFor('academic');
              const rendered = [];
              let i = 0;
              while (i < fields.length) {
                const f = fields[i];
                const next = fields[i + 1];
                const isPair = next && f.id === 'last_school' && next.id === 'last_class';
                if (isPair) {
                  rendered.push(
                    <div key={f.id + next.id} className="grid grid-cols-2 gap-4">
                      <SchemaField field={f}    form={form} set={set} clearErr={clearErr} errors={errors} intakeClasses={intakeClasses} intakeTerms={intakeTerms} themeColor={themeColor} />
                      <SchemaField field={next} form={form} set={set} clearErr={clearErr} errors={errors} intakeClasses={intakeClasses} intakeTerms={intakeTerms} themeColor={themeColor} />
                    </div>
                  );
                  i += 2;
                } else {
                  rendered.push(<SchemaField key={f.id} field={f} form={form} set={set} clearErr={clearErr} errors={errors} intakeClasses={intakeClasses} intakeTerms={intakeTerms} themeColor={themeColor} />);
                  i += 1;
                }
              }
              return rendered;
            })()}

            {/* Document checklist — schema-driven */}
            {schemaFor('documents').length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-3">Documents to Submit on Arrival</p>
                <div className="space-y-2.5">
                  {schemaFor('documents').map(d => (
                    <label key={d.id} className="flex items-center gap-3 cursor-pointer group">
                      <div onClick={() => set(d.id, !form[d.id])}
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                        style={{ background: form[d.id] ? themeColor : 'white', border: `2px solid ${form[d.id] ? themeColor : '#d1d5db'}` }}>
                        {form[d.id] && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M2 6l3 3 5-5"/></svg>
                        )}
                      </div>
                      <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Agreement */}
            <div className="rounded-xl p-4" style={{ background: '#f8faff', border: '1px solid #e2e8f0' }}>
              <label className="flex items-start gap-3 cursor-pointer">
                <div onClick={() => { set('agree', !form.agree); clearErr('agree'); }}
                  className="w-5 h-5 rounded mt-0.5 flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ background: form.agree ? themeColor : 'white', border: `2px solid ${form.agree ? themeColor : errors.agree ? '#ef4444' : '#d1d5db'}` }}>
                  {form.agree && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M2 6l3 3 5-5"/></svg>
                  )}
                </div>
                <span className="text-xs text-gray-600 leading-relaxed">
                  I confirm that the information provided is accurate and complete. I understand that{' '}
                  <strong>{selectedSchool?.name ?? 'the school'}</strong> reserves the right to verify all
                  details and may request additional documentation before confirming enrolment.
                </span>
              </label>
              {errors.agree && <p className="text-[11px] text-red-500 mt-2 ml-8">{errors.agree}</p>}
            </div>
          </StepSection>
        )}

        {/* ─ Step: Review ─ */}
        {currentStepId === 'review' && (
          <StepSection title="Review Application" subtitle="Verify all details before submitting.">
            <ReviewSection title="School & Class">
              <ReviewRow label="School"     value={selectedSchool?.name ?? '—'} />
              <ReviewRow label="Class"      value={form.entry_class || '—'} />
              <ReviewRow label="Entry Term" value={form.entry_term} />
              <ReviewRow label="Residence"  value={form.boarding === 'boarding' ? 'Boarding' : 'Day Scholar'} />
            </ReviewSection>
            <ReviewSection title="Student">
              <ReviewRow label="Full Name"     value={`${form.first_name} ${form.last_name}`.trim() || '—'} />
              <ReviewRow label="Date of Birth" value={form.dob || '—'} />
              <ReviewRow label="Gender"        value={form.gender || '—'} />
              <ReviewRow label="Nationality"   value={form.nationality} />
              {form.religion       && <ReviewRow label="Religion"       value={form.religion} />}
              {form.previous_school && <ReviewRow label="Previous School" value={form.previous_school} />}
            </ReviewSection>
            <ReviewSection title="Parent / Guardian">
              <ReviewRow label="Name"         value={form.parent_name || '—'} />
              <ReviewRow label="Relationship" value={form.relationship || '—'} />
              <ReviewRow label="Phone"        value={form.parent_phone || '—'} />
              {form.parent_email   && <ReviewRow label="Email"   value={form.parent_email} />}
              {form.parent_address && <ReviewRow label="Address" value={form.parent_address} />}
            </ReviewSection>
            {(form.last_school || form.reason) && (
              <ReviewSection title="Academic">
                {form.last_school && <ReviewRow label="Last School" value={form.last_school} />}
                {form.last_class  && <ReviewRow label="Last Class"  value={form.last_class} />}
                {form.reason      && <ReviewRow label="Reason"      value={form.reason} />}
              </ReviewSection>
            )}
          </StepSection>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button onClick={back}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              style={{ borderColor: '#e2e8f0' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
              Back
            </button>
          )}
          <button
            onClick={step === STEPS.length - 1 ? submit : next}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}cc 100%)` }}>
            {step === STEPS.length - 1 ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3"/></svg>
                Submit Application
              </>
            ) : (
              <>
                Continue
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </>
            )}
          </button>
        </div>
      </div>
    </Shell>
  );
}

/* ── Fee table helper ─────────────────────────────────────── */
function FeeTable({ fees, boarding, themeColor }) {
  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#eef0f6' }}>
      <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider" style={{ background: themeColor + '12', color: themeColor }}>
        Fee Structure (per term)
      </div>
      <table className="w-full">
        <thead>
          <tr style={{ background: '#f8faff', borderBottom: '1px solid #eef0f6' }}>
            <th className="text-left text-[10px] font-bold text-gray-400 px-4 py-2 uppercase tracking-wider">Class Range</th>
            <th className="text-right text-[10px] font-bold px-4 py-2 uppercase tracking-wider" style={{ color: boarding === 'boarding' ? themeColor : '#94a3b8' }}>Boarding</th>
            <th className="text-right text-[10px] font-bold px-4 py-2 uppercase tracking-wider" style={{ color: boarding === 'day_scholar' ? themeColor : '#94a3b8' }}>Day Scholar</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: '#f5f7fb' }}>
          {fees.map((f, i) => (
            <tr key={i}>
              <td className="px-4 py-2.5 text-xs font-medium text-gray-600">{f.class}</td>
              <td className={`px-4 py-2.5 text-xs font-bold text-right ${boarding === 'boarding' ? '' : 'text-gray-400'}`}
                style={{ color: boarding === 'boarding' ? '#0B0F2A' : undefined }}>
                {f.boarding}
              </td>
              <td className={`px-4 py-2.5 text-xs font-bold text-right ${boarding === 'day_scholar' ? '' : 'text-gray-400'}`}
                style={{ color: boarding === 'day_scholar' ? '#0B0F2A' : undefined }}>
                {f.dayScholar}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── School info card ─────────────────────────────────────── */
function SchoolInfoCard({ school, config, themeColor }) {
  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: themeColor + '30', background: themeColor + '06' }}>
      <div className="px-4 py-3 flex items-center gap-3 border-b" style={{ borderColor: themeColor + '20' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm text-white flex-shrink-0"
          style={{ background: themeColor }}>
          {school.logo_initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm" style={{ color: '#0B0F2A' }}>{school.name}</div>
          <div className="text-[10px] text-gray-400">{config?.tagline ?? school.district}</div>
        </div>
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 flex-shrink-0">
          {config?.open !== false ? 'Accepting Applications' : 'Closed'}
        </span>
      </div>
      {config?.contact && (
        <div className="px-4 py-2.5 grid grid-cols-3 gap-2 text-[10px] text-gray-500">
          <div><span className="text-gray-400 block">Phone</span><span className="font-semibold text-gray-700">{config.contact.phone}</span></div>
          <div><span className="text-gray-400 block">Email</span><span className="font-semibold truncate block" style={{ color: themeColor }}>{config.contact.email}</span></div>
          <div><span className="text-gray-400 block">Location</span><span className="font-semibold text-gray-700">{config.contact.address}</span></div>
        </div>
      )}
    </div>
  );
}

/* ── Layout shell ─────────────────────────────────────────── */
function Shell({ children, school, config, themeColor, onBack }) {
  const schoolName = school?.name;
  const tagline    = config?.tagline ?? 'Student Enrollment';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #f0f4ff 0%, #fafbff 60%, #f5f3ff 100%)' }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
        style={{ borderBottom: '1px solid #eef0f6', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)' }}>
        <div className="flex items-center gap-3 min-w-0">
          {/* School badge or SkoulHub logo */}
          {school ? (
            <>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-extrabold text-xs flex-shrink-0"
                style={{ background: themeColor }}>
                {school.logo_initials}
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-sm leading-tight truncate" style={{ color: '#0B0F2A' }}>{school.name}</div>
                <div className="text-[10px] text-gray-400 truncate">{tagline}</div>
              </div>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#1E45FC' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5zM6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
              </div>
              <span className="font-extrabold text-sm" style={{ color: '#0B0F2A', fontFamily: 'Fraunces, serif' }}>
                Skoul<span style={{ color: '#A3CF2E' }}>Hub</span>
              </span>
              <span className="text-gray-300 text-xs hidden sm:inline">·</span>
              <span className="text-xs font-semibold text-gray-400 hidden sm:inline">Student Enrollment</span>
            </>
          )}
        </div>
        <button onClick={onBack}
          className="text-xs font-semibold flex items-center gap-1.5 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 ml-4">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
          Back to Login
        </button>
      </header>

      {/* Card */}
      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl overflow-hidden"
          style={{ boxShadow: `0 20px 60px ${themeColor}18` }}>

          {/* Card accent bar */}
          <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${themeColor} 0%, ${themeColor}66 100%)` }} />

          {/* Card header */}
          <div className="px-6 pt-5 pb-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: themeColor + '18', color: themeColor }}>
                Online Application
              </span>
              {schoolName && (
                <span className="text-[10px] text-gray-400 font-medium truncate max-w-[200px]">{schoolName}</span>
              )}
            </div>
            <h1 className="text-xl font-extrabold" style={{ color: '#0B0F2A', fontFamily: 'Fraunces, serif' }}>
              Student Enrollment Form
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 mb-4">Fill in all required fields to apply for admission.</p>
          </div>

          {children}
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-[11px] text-gray-400">
        Powered by <span className="font-bold" style={{ color: themeColor }}>SkoulHub</span> · Secure &amp; Encrypted
      </footer>
    </div>
  );
}

/* ── Small helpers ─────────────────────────────────────────── */
function StepSection({ title, subtitle, children }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-extrabold" style={{ color: '#0B0F2A' }}>{title}</h2>
        <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function ReviewSection({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</p>
      <div className="rounded-xl overflow-hidden border" style={{ borderColor: '#eef0f6' }}>
        {children}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 text-xs" style={{ borderColor: '#f5f7fb' }}>
      <span className="text-gray-400 font-medium">{label}</span>
      <span className="font-semibold text-right max-w-[60%]" style={{ color: '#0B0F2A' }}>{value}</span>
    </div>
  );
}
