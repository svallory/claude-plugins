# DetectGPT & Fast-DetectGPT Implementation

## Core Hypothesis

Text sampled from an LLM tends to occupy **negative curvature regions** of the model's log probability function. Minor rewrites of AI text have lower log probability than the original, while rewrites of human text may have higher or lower probability.

## DetectGPT Algorithm

### Perturbation Discrepancy Formula

```
d(x, ptheta) = (log p_theta(x) - E[log p_theta(x_tilde)]) / sqrt(Var[log p_theta(x_tilde)])
```

Where:
- `x` = candidate text passage
- `p_theta` = source model (model we're detecting)
- `x_tilde` = perturbed versions of x
- `E[...]` = expected value (mean)
- `Var[...]` = variance

### Decision Rule

```
If d(x) > epsilon: classify as AI-generated
If d(x) < epsilon: classify as human-written
```

Typical threshold: `epsilon` varies by domain (use AUROC to optimize)

### Algorithm Steps

```
Algorithm: DetectGPT
Input: candidate passage x, source model p_theta, perturbation model q_phi, threshold epsilon
Output: True (AI) or False (Human)

1. Compute log p_theta(x) - log probability of original text
2. For i = 1 to N (typically 100):
   a. Generate perturbation x_tilde_i ~ q_phi(x_tilde | x)
   b. Compute log p_theta(x_tilde_i)
3. Compute mu_tilde = mean of perturbed log probabilities
4. Compute sigma_tilde = std dev of perturbed log probabilities
5. Compute d_hat = (log p_theta(x) - mu_tilde) / sigma_tilde
6. Return d_hat > epsilon
```

### Perturbation Model

DetectGPT uses **T5-3B** (or similar mask-filling model) to generate perturbations:

1. Randomly mask ~15% of words in passage
2. Use T5 to fill in masked positions
3. This creates semantically similar but lexically different text

## Fast-DetectGPT Algorithm

### Conditional Probability Curvature

```
d(x, p_theta, q_phi) = (log p_theta(x|x) - mu_tilde) / sigma_tilde
```

Key difference: Uses **conditional** probability, enabling single forward pass evaluation.

### Sampling Mechanism

Instead of perturbation, Fast-DetectGPT samples alternative tokens:

```python
# Generate 10,000 samples efficiently
samples = torch.distributions.categorical.Categorical(logits=lprobs).sample([10000])
```

All samples evaluated in same predictive distribution - no iterative generation needed.

### Algorithm Steps

```
Algorithm: Fast-DetectGPT
Input: passage x, scoring model p_theta, sampling model q_phi, threshold epsilon
Output: True (AI) or False (Human)

1. Sample N alternative passages from q_phi(x_tilde | x)
   - For each position j, sample alternative tokens given context x_<j
2. Compute mu_tilde = average log probability of samples
3. Compute sigma_tilde^2 = variance of sample log probabilities
4. Calculate d_hat = (log p_theta(x) - mu_tilde) / sigma_tilde
5. Return d_hat > epsilon
```

### Curvature Interpretation

| d_hat Value | Interpretation |
|-------------|----------------|
| d_hat ~ 3 | Machine-generated (positive curvature) |
| d_hat ~ 0 | Human-written (near-zero curvature) |
| d_hat < 0 | Likely human (negative curvature) |

## Implementation

### DetectGPT (Original)

```python
import torch
import numpy as np
from transformers import AutoModelForCausalLM, AutoModelForSeq2SeqLM, AutoTokenizer

class DetectGPT:
    def __init__(
        self,
        source_model: str = 'gpt2-medium',
        perturbation_model: str = 't5-large',
        device: str = 'cuda'
    ):
        self.device = device

        # Source model (for probability calculation)
        self.source_tokenizer = AutoTokenizer.from_pretrained(source_model)
        self.source_model = AutoModelForCausalLM.from_pretrained(source_model).to(device)
        self.source_model.eval()

        # Perturbation model
        self.perturb_tokenizer = AutoTokenizer.from_pretrained(perturbation_model)
        self.perturb_model = AutoModelForSeq2SeqLM.from_pretrained(perturbation_model).to(device)
        self.perturb_model.eval()

    def get_log_probability(self, text: str) -> float:
        """Calculate log probability of text under source model."""
        inputs = self.source_tokenizer(text, return_tensors='pt').to(self.device)

        with torch.no_grad():
            outputs = self.source_model(**inputs, labels=inputs['input_ids'])
            log_prob = -outputs.loss.item() * inputs['input_ids'].size(1)

        return log_prob

    def perturb_text(self, text: str, mask_ratio: float = 0.15) -> str:
        """Generate perturbation using T5 mask-filling."""
        words = text.split()
        n_mask = max(1, int(len(words) * mask_ratio))

        # Randomly select positions to mask
        mask_positions = np.random.choice(len(words), n_mask, replace=False)

        # Create masked text
        masked_words = words.copy()
        for pos in sorted(mask_positions):
            masked_words[pos] = '<extra_id_0>'

        masked_text = ' '.join(masked_words)

        # Fill masks with T5
        inputs = self.perturb_tokenizer(masked_text, return_tensors='pt').to(self.device)
        with torch.no_grad():
            outputs = self.perturb_model.generate(**inputs, max_length=50)
        filled = self.perturb_tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Reconstruct (simplified - real impl more complex)
        return filled

    def detect(self, text: str, n_perturbations: int = 100) -> dict:
        """
        Run DetectGPT detection.

        Returns dict with score, classification, and confidence.
        """
        # Original log probability
        original_log_prob = self.get_log_probability(text)

        # Generate and score perturbations
        perturbed_log_probs = []
        for _ in range(n_perturbations):
            perturbed = self.perturb_text(text)
            if len(perturbed.split()) >= 5:  # Skip degenerate perturbations
                perturbed_log_probs.append(self.get_log_probability(perturbed))

        if len(perturbed_log_probs) < 10:
            return {'error': 'Too few valid perturbations'}

        # Calculate curvature score
        mu = np.mean(perturbed_log_probs)
        sigma = np.std(perturbed_log_probs)

        if sigma == 0:
            return {'error': 'Zero variance in perturbations'}

        d_score = (original_log_prob - mu) / sigma

        # Classification
        if d_score > 2.0:
            classification = 'AI-generated'
            confidence = 'High'
        elif d_score > 1.0:
            classification = 'Likely AI'
            confidence = 'Medium'
        elif d_score < -1.0:
            classification = 'Likely Human'
            confidence = 'Medium'
        elif d_score < -2.0:
            classification = 'Human-written'
            confidence = 'High'
        else:
            classification = 'Uncertain'
            confidence = 'Low'

        return {
            'd_score': round(d_score, 3),
            'original_log_prob': round(original_log_prob, 3),
            'mean_perturbed_log_prob': round(mu, 3),
            'std_perturbed_log_prob': round(sigma, 3),
            'n_perturbations': len(perturbed_log_probs),
            'classification': classification,
            'confidence': confidence
        }
```

### Fast-DetectGPT (Simplified)

```python
class FastDetectGPT:
    def __init__(self, model_name: str = 'gpt2-medium', device: str = 'cuda'):
        self.device = device
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(model_name).to(device)
        self.model.eval()

    def detect(self, text: str, n_samples: int = 10000) -> dict:
        """
        Fast-DetectGPT using conditional probability curvature.
        """
        inputs = self.tokenizer(text, return_tensors='pt').to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits

        # Get log probabilities
        log_probs = torch.log_softmax(logits, dim=-1)

        # Sample alternative tokens
        samples = torch.distributions.Categorical(logits=logits).sample([n_samples])

        # Calculate conditional log probs for samples
        sample_log_probs = []
        for sample in samples:
            sample_prob = 0
            for i, token in enumerate(sample[0, :-1]):
                sample_prob += log_probs[0, i, token].item()
            sample_log_probs.append(sample_prob)

        # Original conditional log prob
        original_tokens = inputs['input_ids'][0, 1:]
        original_prob = 0
        for i, token in enumerate(original_tokens):
            original_prob += log_probs[0, i, token].item()

        # Calculate curvature
        mu = np.mean(sample_log_probs)
        sigma = np.std(sample_log_probs)

        if sigma == 0:
            return {'error': 'Zero variance'}

        d_score = (original_prob - mu) / sigma

        return {
            'd_score': round(d_score, 3),
            'classification': 'AI' if d_score > 1.5 else 'Human' if d_score < 0.5 else 'Uncertain'
        }
```

## Performance Benchmarks

| Method | AUROC | Speed |
|--------|-------|-------|
| DetectGPT | 0.95 | 1x (baseline) |
| Fast-DetectGPT | 0.96 | 340x faster |

### By Model

| Source Model | DetectGPT AUROC |
|--------------|-----------------|
| GPT-2 | 0.91 |
| GPT-Neo 2.7B | 0.93 |
| GPT-NeoX 20B | 0.95 |
| OPT 13B | 0.94 |

## Limitations

1. **Compute intensive**: Original DetectGPT requires ~100 forward passes
2. **Model access**: Need access to (or proxy for) source model
3. **Domain shift**: Performance degrades on out-of-distribution text
4. **Paraphrased text**: Heavy paraphrasing can evade detection
5. **Short texts**: Less reliable for <100 tokens

## Official Implementations

- **DetectGPT**: https://github.com/eric-mitchell/detect-gpt
- **Fast-DetectGPT**: https://github.com/baoguangsheng/fast-detect-gpt

## Sources

- [DetectGPT Paper (arXiv)](https://arxiv.org/abs/2301.11305)
- [Fast-DetectGPT Paper (arXiv)](https://arxiv.org/html/2310.05130v3)
- [DetectGPT GitHub](https://github.com/eric-mitchell/detect-gpt)
