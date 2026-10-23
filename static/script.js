// Point this at your deployed FastAPI service, e.g. https://credit-risk-api.onrender.com

const API_URL = window.API_URL || "";

const $ = (id) => document.getElementById(id);
const form = $("form"), btn = $("submit"), errorBox = $("error");
const result = $("result"), arc = $("arc"), tick = $("tick");

const NUMERIC = ["person_age","person_income","person_emp_length","loan_amnt","loan_int_rate","loan_percent_income","cb_person_cred_hist_length"];

// Loan-to-income ratio updates live
function syncRatio() {
  const inc = parseFloat(form.person_income.value), amt = parseFloat(form.loan_amnt.value);
  form.loan_percent_income.value = inc > 0 && amt >= 0 ? (amt / inc).toFixed(2) : "";
}
form.person_income.addEventListener("input", syncRatio);
form.loan_amnt.addEventListener("input", syncRatio);
syncRatio();

function validate() {
  let ok = true;
  form.querySelectorAll("input:not([readonly])").forEach((el) => {
    const bad = el.value === "" || Number(el.value) < Number(el.min || -Infinity);
    el.classList.toggle("invalid", bad);
    if (bad) ok = false;
  });
  return ok;
}
form.addEventListener("input", (e) => e.target.classList.remove("invalid"));

function payload() {
  const fd = new FormData(form), out = {};
  for (const [k, v] of fd.entries()) out[k] = NUMERIC.includes(k) ? Number(v) : v;
  out.person_age = Math.round(out.person_age);
  return out;
}

function countUp(el, to, ms = 1400) {
  const start = performance.now();
  const step = (t) => {
    const p = Math.min((t - start) / ms, 1), eased = 1 - Math.pow(1 - p, 4);
    el.textContent = (to * eased).toFixed(1);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function showResult(data, sent) {
  const pct = data.default_probability * 100;
  const high = data.default_prediction === 1;

  result.classList.remove("low", "high", "pop");
  arc.style.strokeDasharray = "0 100";
  void result.offsetWidth; // restart animations

  result.classList.add(high ? "high" : "low", "pop");
  arc.style.strokeDasharray = `${Math.max(pct, 0.8)} 100`;
  tick.style.transform = `rotate(${-90 + data.threshold * 180}deg)`;

  $("pct").hidden = false;
  countUp($("num"), pct);
  $("verdict").textContent = high ? "High risk of default" : "Low risk of default";
  $("note").textContent = high
    ? "The estimated risk is above the model's cut-off. This application needs a closer look."
    : "The estimated risk is below the model's cut-off. This application looks sound.";
  $("thr").textContent = (data.threshold * 100).toFixed(1) + "%";
  $("lpi").textContent = (sent.loan_percent_income * 100).toFixed(0) + "% of income";
  $("facts").hidden = false;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  if (!validate()) {
    errorBox.textContent = "Some fields are empty or out of range. Fix the highlighted fields and try again.";
    errorBox.hidden = false;
    return;
  }

  const body = payload();
  btn.classList.add("loading");
  btn.querySelector(".label").textContent = "Assessing…";
  // Free Render instances sleep; tell the user if the first call is slow
  const slow = setTimeout(() => (btn.querySelector(".label").textContent = "Waking up the server…"), 4000);

  try {
    const res = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`The server returned an error (${res.status}).`);
    showResult(await res.json(), body);
  } catch (err) {
    errorBox.textContent = err instanceof TypeError
      ? "Can't reach the API. Check that it's running and that API_URL in script.js is correct."
      : err.message;
    errorBox.hidden = false;
  } finally {
    clearTimeout(slow);
    btn.classList.remove("loading");
    btn.querySelector(".label").textContent = "Assess risk";
  }
});
