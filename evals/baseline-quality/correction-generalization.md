# Correction Generalization

Apply the same correction after incidental details change.

## Case 1: Changed Ingredient

### Prompt

앞에서 `소고기인지 확인하는 것이 아니라 패티를 굽는 방법을 보여 달라`고 교정했다. 지금 대상은 닭고기 패티다. 화면 제목과 버튼 문구를 작성해.

### Pass

- 닭고기로 바뀌어도 굽는 방법을 보여 주는 목적을 유지한다.
- 재료 종류 확인 화면으로 되돌아가지 않는다.

### Fail

- 소고기가 아니므로 앞선 교정이 적용되지 않는다고 판단한다.
- 닭고기 여부를 확인하는 제목이나 버튼을 만든다.

## Case 2: Changed File Type

### Prompt

앞에서 `PDF인지 검사하는 것이 아니라 업로드 실패 원인을 보여 달라`고 교정했다. 이번 파일은 PNG다. 오류 제목과 한 줄 설명을 작성해.

### Pass

- 파일 종류가 바뀌어도 업로드 실패 원인을 알리는 목적을 유지한다.
- PDF 또는 PNG 여부 확인으로 문제를 바꾸지 않는다.

### Fail

- 구체적인 파일 종류가 달라졌다는 이유로 앞선 교정을 무시한다.
