import fs from 'node:fs';
import path from 'node:path';

const html = fs.readFileSync(path.join(import.meta.dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('/* CORE-START');
const end = html.indexOf('/* CORE-END');
const core = html.slice(start, html.indexOf('*/', end) + 2);

const api = new Function(core + `
  return { parseEng, formatEng, ohmSolve, dividerVout, dividerR2, rcCutoff, rcMagnitudeDb, resistorValue, nearestE24 };
`)();

let pass = 0, fail = 0;
function near(a, b, tol = 1e-9) { return a !== null && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)); }
function check(name, actual, expected, cmp = (a, b) => a === b) {
  const ok = cmp(actual, expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ->  ${typeof actual === 'number' ? actual : JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
}

// --- parseEng ---
check('parseEng("4.7k")', api.parseEng('4.7k'), 4700);
check('parseEng("10µ")', api.parseEng('10µ'), 1e-5, near);
check('parseEng("10u")', api.parseEng('10u'), 1e-5, near);
check('parseEng("10μ")', api.parseEng('10μ'), 1e-5, near);
check('parseEng("2M")', api.parseEng('2M'), 2e6);
check('parseEng("100nF")', api.parseEng('100nF'), 1e-7, near);
check('parseEng("4.7kΩ")', api.parseEng('4.7kΩ'), 4700);
check('parseEng("2 mA") (formatted value re-reads)', api.parseEng('2 mA'), 2e-3, near);
check('parseEng("4k7") rejects EIA form', api.parseEng('4k7'), null);
check('parseEng("2M2") rejects EIA form', api.parseEng('2M2'), null);
check('parseEng("abc")', api.parseEng('abc'), null);
check('parseEng("")', api.parseEng(''), null);

// --- formatEng round-trips ---
check('formatEng(27000,"Ω")', api.formatEng(27000, 'Ω'), '27 kΩ');
check('formatEng(0.002,"A")', api.formatEng(0.002, 'A'), '2 mA');
check('formatEng(0.02,"W")', api.formatEng(0.02, 'W'), '20 mW');
check('formatEng(1591.549,"Hz")', api.formatEng(1591.549, 'Hz'), '1.5915 kHz');
check('formatEng(6.82e3,"Ω")', api.formatEng(6820, 'Ω'), '6.82 kΩ');

// --- Ohm's law: V=10, R=5k -> I=2mA, P=20mW ---
const ohm = api.ohmSolve({ V: 10, R: 5000 });
check("ohmSolve V=10,R=5k I", ohm.I, 0.002, near);
check("ohmSolve V=10,R=5k P", ohm.P, 0.02, near);
check("ohmSolve R=0 guarded", api.ohmSolve({ V: 10, R: 0 }).error !== undefined, true);

// --- resistor color code ---
check('4-band red-violet-orange-gold', api.resistorValue([2, 7], 3), 27000);
check('5-band blue-grey-red-brown-brown', api.resistorValue([6, 8, 2], 1), 6820);

// --- divider ---
check('dividerVout(12, 10k, 2.2k)', api.dividerVout(12, 10000, 2200), 2.1639344262295082, near);
check('dividerR2(5, 10k, 3.3)', api.dividerR2(5, 10000, 3.3), 19411.764705882353, near);
check('dividerR2 rejects Vout >= Vin', api.dividerR2(5, 10000, 5), null);
check('dividerVout rejects R1+R2=0', api.dividerVout(12, 0, 0), null);

// --- RC ---
check('rcCutoff(1k, 100n)', api.rcCutoff(1000, 100e-9), 1591.5494309189535, near);
check('rcMagnitudeDb at fc', api.rcMagnitudeDb(1000, 1000), -3.0102999566398120, near);

// --- E24 helper ---
check('nearestE24(19411.76)', api.nearestE24(19411.76), 20000, near);

console.log(`\n${pass}/${pass + fail} assertions passed`);
process.exit(fail === 0 ? 0 : 1);
