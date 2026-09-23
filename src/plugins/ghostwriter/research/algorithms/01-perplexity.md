# Perplexity Calculation Implementation

## Mathematical Definition

Perplexity is defined as the exponentiated average negative log-likelihood of a sequence:

```
PPL(X) = exp{-1/t * sum(log p(xi | x<i))}
```

Where:
- `t` = number of tokens
- `p(xi | x<i)` = probability of token `xi` conditioned on all preceding tokens

Equivalently:

```
PPL = 2^(-1/N * sum(log2 P(ti | t1...ti-1)))
```

## Interpretation

| Perplexity | Meaning |
|------------|---------|
| Close to 1 | Highly predictable (typical of AI) |
| Higher values | Less predictable (typical of humans) |
| AI text | Typically 5-20 |
| Human text | Typically 20-85+ |
| Threshold (GPTZero) | PPL = 20 boundary |

## Reference Model Selection

### Commonly Used Models

| Model | Parameters | Context | Use Case |
|-------|-----------|---------|----------|
| `gpt2` | 124M | 1024 | Fast, lightweight baseline |
| `gpt2-medium` | 355M | 1024 | Better accuracy |
| `gpt2-large` | 774M | 1024 | Higher quality |
| `gpt2-xl` | 1.5B | 1024 | Best quality, slower |

**Recommendation**: Use `gpt2-medium` for balance of speed and accuracy.

## Implementation

### Basic Implementation

```python
import torch
import math
from transformers import GPT2LMHeadModel, GPT2TokenizerFast

def calculate_perplexity(
    text: str,
    model_name: str = 'gpt2-medium',
    stride: int = 512
) -> dict:
    """
    Calculate perplexity using sliding window approach.

    Args:
        text: Input text to evaluate
        model_name: HuggingFace model identifier
        stride: Overlap between windows (lower = more accurate, slower)

    Returns:
        dict with overall and per-sentence perplexity
    """
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    tokenizer = GPT2TokenizerFast.from_pretrained(model_name)
    model = GPT2LMHeadModel.from_pretrained(model_name).to(device)
    model.eval()

    encodings = tokenizer(text, return_tensors='pt')
    max_length = model.config.n_positions  # 1024 for GPT-2
    seq_len = encodings.input_ids.size(1)

    nlls = []
    prev_end_loc = 0

    for begin_loc in range(0, seq_len, stride):
        end_loc = min(begin_loc + max_length, seq_len)
        trg_len = end_loc - prev_end_loc  # Tokens to predict this iteration

        input_ids = encodings.input_ids[:, begin_loc:end_loc].to(device)
        target_ids = input_ids.clone()
        target_ids[:, :-trg_len] = -100  # Mask non-target tokens

        with torch.no_grad():
            outputs = model(input_ids, labels=target_ids)
            neg_log_likelihood = outputs.loss * trg_len

        nlls.append(neg_log_likelihood)
        prev_end_loc = end_loc

        if end_loc == seq_len:
            break

    ppl = torch.exp(torch.stack(nlls).sum() / end_loc).item()

    return {
        'perplexity': ppl,
        'token_count': seq_len,
        'model': model_name
    }
```

### Sentence-Level Perplexity

```python
import nltk

def sentence_level_perplexity(text: str, model_name: str = 'gpt2-medium') -> dict:
    """
    Calculate perplexity for each sentence.
    Critical for burstiness calculation.
    """
    nltk.download('punkt', quiet=True)
    sentences = nltk.sent_tokenize(text)

    sentence_ppls = []
    for sent in sentences:
        if len(sent.split()) >= 3:  # Skip very short sentences
            result = calculate_perplexity(sent, model_name, stride=1024)
            sentence_ppls.append({
                'sentence': sent,
                'perplexity': result['perplexity'],
                'tokens': result['token_count']
            })

    ppls = [s['perplexity'] for s in sentence_ppls]

    return {
        'sentences': sentence_ppls,
        'mean_perplexity': sum(ppls) / len(ppls) if ppls else 0,
        'std_perplexity': (sum((p - sum(ppls)/len(ppls))**2 for p in ppls) / len(ppls))**0.5 if ppls else 0,
        'min_perplexity': min(ppls) if ppls else 0,
        'max_perplexity': max(ppls) if ppls else 0,
    }
```

## Sliding Window Strategy

For texts longer than the model's context window (1024 tokens for GPT-2):

### Without Overlap (stride = max_length)

```
Text: [----1024----][----1024----][--remaining--]
```
- WikiText-2 PPL: 19.44 (matches GPT-2 paper's 19.93)

### With Overlap (stride = 512)

```
Text: [----1024----]
           [----1024----]
                  [----1024----]
```
- WikiText-2 PPL: 16.44 (more accurate)

**Trade-off**: Lower stride = more accurate but slower.

## Thresholds for Detection

| Score Range | Classification | Confidence |
|-------------|---------------|------------|
| PPL < 10 | AI-generated | High |
| PPL 10-20 | Likely AI | Medium |
| PPL 20-50 | Ambiguous | Low |
| PPL 50-85 | Likely human | Medium |
| PPL > 85 | Human-written | High |

## Limitations and Caveats

1. **Over-represented texts**: Famous passages (Bible, Declaration of Independence) classify as AI due to high representation in training data.

2. **ESL writers**: Non-native speakers produce more predictable text, lower perplexity.

3. **Domain-specific**: Technical/jargon-heavy text may have different baselines.

4. **Model dependency**: Results vary based on reference model used.

5. **Text length**: Very short texts (<50 tokens) produce unreliable scores.

## Libraries

| Library | Install | Notes |
|---------|---------|-------|
| [lmppl](https://github.com/asahi417/lmppl) | `pip install lmppl` | Supports MLM, causal, encoder-decoder |
| [perplexed](https://pypi.org/project/perplexed/) | `pip install perplexed` | Find where model is confused |
| torchmetrics | `pip install torchmetrics` | `Perplexity` class |

## Sources

- [Hugging Face Perplexity Guide](https://huggingface.co/docs/transformers/perplexity)
- [GPTZero Technical Details](https://gptzero.me/news/perplexity-and-burstiness-what-is-it/)
- [lmppl Library](https://github.com/asahi417/lmppl)
