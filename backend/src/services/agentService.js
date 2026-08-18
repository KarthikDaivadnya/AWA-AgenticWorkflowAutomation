// import Anthropic from "@anthropic-ai/sdk";

// const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// // Each agent step type maps to a system prompt. The step chain feeds
// // output -> next input, which is what makes this "agentic" rather than
// // a single one-shot call.
// const STEP_PROMPTS = {
//   summarize: `You are a summarization agent. Summarize the input clearly and concisely, preserving key facts, names, and numbers. Output only the summary, no preamble.`,

//   extract: `You are a data extraction agent. Extract key structured data points (entities, dates, amounts, names, action items) from the input. Output ONLY valid JSON — an object with clear field names. No markdown fences, no explanation.`,

//   classify: `You are a classification agent. Read the input and classify it into ONE clear category (e.g. urgent/normal/low-priority, or a relevant domain category based on content). Output ONLY the category label and a one-sentence justification, nothing else.`,

//   draft_reply: `You are a reply-drafting agent. Based on the input, draft a professional, concise reply or response. Output only the drafted message, no preamble.`,

//   custom: null, // uses step.prompt directly as the system prompt
// };

// export async function runStep(step, inputText) {
//   if (!process.env.ANTHROPIC_API_KEY) {
//     throw new Error(
//       "ANTHROPIC_API_KEY is not set. Add it to backend/.env to run AI steps."
//     );
//   }

//   const systemPrompt =
//     step.type === "custom"
//       ? step.prompt || "Process the input and return a useful result."
//       : STEP_PROMPTS[step.type];

//   if (!systemPrompt) {
//     throw new Error(`Unknown step type: ${step.type}`);
//   }

//   const response = await anthropic.messages.create({
//     model: MODEL,
//     max_tokens: 1024,
//     system: systemPrompt,
//     messages: [{ role: "user", content: inputText }],
//   });

//   const textBlock = response.content.find((b) => b.type === "text");
//   return textBlock ? textBlock.text : "";
// }

// export async function runWorkflow(steps, initialInput, onStepComplete) {
//   let currentInput = initialInput;
//   const results = [];

//   for (const step of steps) {
//     const startedAt = new Date().toISOString();
//     try {
//       const output = await runStep(step, currentInput);
//       const result = {
//         stepId: step.id,
//         type: step.type,
//         label: step.label,
//         input: currentInput,
//         output,
//         status: "success",
//         startedAt,
//         finishedAt: new Date().toISOString(),
//       };
//       results.push(result);
//       if (onStepComplete) onStepComplete(result);
//       currentInput = output; // chain: next step consumes this step's output
//     } catch (err) {
//       const result = {
//         stepId: step.id,
//         type: step.type,
//         label: step.label,
//         input: currentInput,
//         output: null,
//         status: "error",
//         error: err.message,
//         startedAt,
//         finishedAt: new Date().toISOString(),
//       };
//       results.push(result);
//       if (onStepComplete) onStepComplete(result);
//       throw Object.assign(new Error(err.message), { partialResults: results });
//     }
//   }

//   return results;
// }


import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

// Each agent step type maps to a system prompt. The step chain feeds
// output -> next input, which is what makes this "agentic" rather than
// a single one-shot call.
const STEP_PROMPTS = {
  summarize: `You are a summarization agent. Summarize the input clearly and concisely, preserving key facts, names, and numbers. Output only the summary, no preamble.`,

  extract: `You are a data extraction agent. Extract key structured data points (entities, dates, amounts, names, action items) from the input. Output ONLY valid JSON — an object with clear field names. No markdown fences, no explanation.`,

  classify: `You are a classification agent. Read the input and classify it into ONE clear category (e.g. urgent/normal/low-priority, or a relevant domain category based on content). Output ONLY the category label and a one-sentence justification, nothing else.`,

  draft_reply: `You are a reply-drafting agent. Based on the input, draft a professional, concise reply or response. Output only the drafted message, no preamble.`,

  custom: null, // uses step.prompt directly as the system prompt
};

export async function runStep(step, inputText) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to backend/.env to run AI steps."
    );
  }

  const systemPrompt =
    step.type === "custom"
      ? step.prompt || "Process the input and return a useful result."
      : STEP_PROMPTS[step.type];

  if (!systemPrompt) {
    throw new Error(`Unknown step type: ${step.type}`);
  }

  const response = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: inputText },
    ],
  });

  return response.choices[0]?.message?.content || "";
}

export async function runWorkflow(steps, initialInput, onStepComplete) {
  let currentInput = initialInput;
  const results = [];

  for (const step of steps) {
    const startedAt = new Date().toISOString();
    try {
      const output = await runStep(step, currentInput);
      const result = {
        stepId: step.id,
        type: step.type,
        label: step.label,
        input: currentInput,
        output,
        status: "success",
        startedAt,
        finishedAt: new Date().toISOString(),
      };
      results.push(result);
      if (onStepComplete) onStepComplete(result);
      currentInput = output; // chain: next step consumes this step's output
    } catch (err) {
      const result = {
        stepId: step.id,
        type: step.type,
        label: step.label,
        input: currentInput,
        output: null,
        status: "error",
        error: err.message,
        startedAt,
        finishedAt: new Date().toISOString(),
      };
      results.push(result);
      if (onStepComplete) onStepComplete(result);
      throw Object.assign(new Error(err.message), { partialResults: results });
    }
  }

  return results;
}