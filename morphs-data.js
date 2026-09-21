/* Names describe appearance, genetic traits or combinations; they are not interchangeable genotypes. */
(() => {
  const groups = { basic: '기본 무늬', detail: '부분 특징', spots: '점 무늬', color: '색상', genetic: '유전 모프', combo: '조합 모프', line: '라인 · 기타' };
  const appearance = '외형·선별교배 명칭입니다. 이름만으로 자손의 정확한 확률을 계산하지 않습니다.';
  const entries = [
    ['normal','노멀','Normal','basic','특정 모프를 강조하지 않은 일반적인 분양 표기.','노멀은 모든 열성 유전자가 없다는 뜻이 아닙니다. 부모와 혈통 정보를 함께 확인하세요.'],
    ['patternless','패턴리스','Patternless','basic','등과 옆구리의 대비되는 무늬가 적고 바탕색이 비교적 균일합니다.'],
    ['bicolor','바이컬러','Bicolor','basic','등과 몸 옆면이 서로 다른 두 색조로 구분됩니다.'],
    ['flame','플레임','Flame','basic','등에 밝은 무늬가 두드러지고 옆구리·다리 무늬는 상대적으로 적습니다.'],
    ['harlequin','할리퀸','Harlequin','basic','등뿐 아니라 옆구리와 다리까지 밝은 패턴이 이어집니다.'],
    ['extreme-harlequin','익스트림 할리퀸','Extreme Harlequin','basic','옆구리와 다리의 밝은 패턴 범위가 넓은 할리퀸 계열입니다.','표현 정도를 부르는 명칭이며 판정 기준은 브리더마다 다를 수 있습니다.'],
    ['tiger','타이거','Tiger','basic','몸을 가로지르는 비교적 뚜렷한 어두운 줄무늬가 특징입니다.'],
    ['brindle','브린들','Brindle','basic','타이거보다 불규칙하고 잘게 나뉘거나 연결된 어두운 무늬가 보입니다.'],
    ['brindlequin','브린들퀸','Brindlequin','basic','브린들 줄무늬와 할리퀸의 밝은 옆구리 패턴을 함께 표현한 명칭입니다.'],
    ['tricolor','트라이컬러','Tricolor','basic','바탕색과 크림·흰색 등 세 색의 대비가 구분되는 표현입니다.'],
    ['pinstripe','핀스트라이프','Pinstripe','detail','등 양쪽 능선을 따라 밝은 비늘이 선처럼 이어집니다.'],
    ['full-pinstripe','풀 핀스트라이프','Full Pinstripe','detail','등 양쪽 핀 라인이 거의 끊김 없이 이어지는 표현입니다.'],
    ['partial-pinstripe','부분 핀스트라이프','Partial Pinstripe','detail','등의 핀 라인이 일부만 나타나거나 중간에 끊깁니다.'],
    ['reverse-pinstripe','리버스 핀스트라이프','Reverse Pinstripe','detail','등 핀 라인의 바깥쪽을 따라 어두운 선이 강조됩니다.'],
    ['quadstripe','쿼드스트라이프','Quadstripe','detail','등 양쪽 선과 옆구리 선을 함께 네 줄로 표현하는 명칭입니다.'],
    ['whitewall','화이트월','White Wall','detail','옆구리의 밝은 무늬가 벽처럼 넓게 연결되어 보입니다.'],
    ['drippy','드리피','Drippy','detail','등의 밝은 무늬가 옆구리로 흘러내리는 듯한 모양입니다.'],
    ['portholes','포트홀','Portholes','detail','옆구리에 밝고 둥근 반점이 줄지어 나타납니다.'],
    ['white-spots','화이트스팟','White Spots','detail','몸에 나타나는 흰색·크림색 반점을 가리킵니다.','화이트스팟만으로 릴리화이트 여부를 확정하지 않습니다.'],
    ['solid-back','솔리드백','Solid Back','detail','등의 밝은 패턴이 비교적 빈틈없이 채워져 보이는 표현입니다.','단일 유전자처럼 25%·50% 확률을 부여하지 않습니다.'],
    ['dalmatian','달마시안','Dalmatian','spots','몸에 검정·붉은색 등의 점이 나타납니다. 다른 무늬와 함께 표기할 수 있습니다.'],
    ['super-dalmatian','슈퍼 달마시안','Super Dalmatian','spots','점이 많고 밀도가 높은 달마시안을 부르는 표현입니다.','여기서 슈퍼는 점 표현을 강조한 이름이며 유전자 두 사본을 뜻하지 않습니다.'],
    ['inkspot','잉크스팟','Ink Spot','spots','잉크가 떨어진 듯 크고 뚜렷한 점이 특징입니다.'],
    ['redspot','레드스팟','Red Spot','spots','검은 점과 구분되는 붉은 계열 점을 표현합니다.'],
    ['confetti','컨페티','Confetti','spots','여러 색조의 점이 함께 나타나는 달마시안 계열의 통용명입니다.'],
    ['red','레드','Red','color','붉은 바탕색이 강조되는 개체입니다.'],
    ['orange','오렌지','Orange','color','주황 계열의 바탕색이 강조됩니다.'],
    ['yellow','옐로','Yellow','color','노란 계열의 바탕색이 강조됩니다.'],
    ['cream','크림','Cream','color','부드러운 크림색 표현을 가리킵니다.'],
    ['brown','브라운','Brown','color','갈색 계열의 바탕색을 표현합니다.'],
    ['dark','다크','Dark','color','짙은 갈색·어두운 바탕색이 강조되는 표현입니다.','어두운 색만으로 카푸치노·아잔틱 등 유전 모프를 판정하지 않습니다.'],
    ['lavender','라벤더','Lavender','color','회보라색처럼 보이는 바탕색을 표현하는 통용명입니다.','조명·화이트밸런스·파이어 상태에 따라 달라 보일 수 있습니다.'],
    ['lilly','릴리화이트','Lilly White','genetic','등·옆구리의 넓은 크림색 또는 흰색 표현이 특징인 유전 모프입니다.','불완전우성으로 다룹니다. 슈퍼 릴리의 치사 위험 때문에 릴리끼리 교배는 권장하지 않습니다.'],
    ['axanthic','아잔틱','Axanthic','genetic','노랑·빨강 계열 색소 표현이 줄어 회색·흑백 계열로 보이는 유전 모프입니다.','열성으로 다룹니다. 헷 여부와 계통 호환성은 혈통·교배 기록으로 확인해야 합니다.'],
    ['cappuccino','카푸치노','Cappuccino','genetic','어두운 색과 꼬리 기부 등의 특징으로 알려진 유전 모프입니다.','불완전우성으로 다룹니다. 외형만으로 확정하지 않으며 슈퍼형은 건강 문제 보고가 있습니다.'],
    ['sable','세이블','Sable','genetic','색·패턴의 독특한 표현으로 분류하는 유전 모프명입니다.','출처와 혈통을 확인하세요. 이 사이트는 세이블과 카푸치노의 관계를 독립 유전자로 가정해 계산하지 않습니다.'],
    ['phantom','팬텀','Phantom','genetic','밝은 패턴의 표현이 억제되거나 줄어드는 특징으로 설명됩니다.','패턴리스와 같은 뜻이 아닙니다. 혈통을 확인하며 현재 확률 계산에는 포함하지 않습니다.'],
    ['softscale','소프트스케일','Soft Scale','genetic','비늘의 크기·배열·질감 차이를 표현하는 모프명입니다.','사진의 매끈한 인상만으로 판정하기 어렵습니다. 혈통을 확인하며 현재 확률 계산에는 포함하지 않습니다.'],
    ['hypo','하이포','Hypo','genetic','어두운 색소 표현이 감소하는 특징을 가리키는 이름입니다.','밝은 개체 모두를 하이포로 확정하지 않습니다. 라인별 근거를 확인하며 현재 확률 계산에는 포함하지 않습니다.'],
    ['lilly-axanthic','릴리아잔틱','Lilly White Axanthic','combo','릴리화이트와 비주얼 아잔틱이 함께 표현된 조합입니다.','릴리화이트·아잔틱과 구분되는 조합 모프입니다. 릴리 100% 헷 아잔틱과도 다릅니다.','릴잔틱, 릴리 아잔틱'],
    ['frappuccino','프라푸치노','Frappuccino','combo','릴리화이트와 카푸치노가 함께 표현된 조합입니다.','분양명만 보지 말고 두 유전 형질과 혈통을 확인하세요.'],
    ['solid-lilly','솔리드 릴리','Solid Lilly','combo','릴리화이트에 솔리드백 표현이 함께 나타난 개체를 부르는 이름입니다.','솔리드백은 표현형이므로 고정된 멘델 확률로 계산하지 않습니다.','솔리드릴리'],
    ['solid-lilly-axanthic','솔리드 릴리아잔틱','Solid Lilly Axanthic','combo','릴리아잔틱에 솔리드백 표현이 더해진 조합 표기입니다.','릴리·아잔틱 유전 상태와 솔리드백 외형 특징을 따로 기록하세요.','솔리드 릴잔틱'],
    ['lilly-het','릴리 100% 헷 아잔틱','Lilly White 100% Het Axanthic','combo','릴리화이트이면서 아잔틱 유전자 한 사본을 가진 것으로 확인된 개체입니다.','비주얼 아잔틱이나 릴리아잔틱이 아닙니다. 헷은 외형만으로 확인할 수 없습니다.'],
    ['pixel','픽셀','Pixel','line','무늬가 작은 조각처럼 보이는 표현 등에 사용하는 명칭입니다.','명칭의 범위와 유전 주장은 출처별로 확인하세요. 현재 확률 계산에는 포함하지 않습니다.'],
    ['line','혈통 · 라인명','Line / Lineage','line','특정 브리더·개체군의 출처를 나타내는 이름입니다.','라인명과 유전 모프는 별개입니다. 원래 분양 표기를 별도로 보존하세요.']
  ].map(([id,name,en,group,look,note,aliases='']) => ({id,name,en,group,look,note:note||appearance,aliases}));
  const key = value => String(value).toLowerCase().replace(/[\s·_-]/g,'');
  function search(query='', group='') {
    const q=key(query);
    return entries.filter(m=>(!group||m.group===group)&&key([m.name,m.en,m.aliases,m.look].join(' ')).includes(q));
  }
  function toggleTrait(value, name) {
    const names=String(value).split(',').map(v=>v.trim()).filter(Boolean);
    return (names.includes(name)?names.filter(v=>v!==name):[...names,name]).join(', ');
  }
  globalThis.CrestieMorphs={groups,entries,search,toggleTrait};
})();
