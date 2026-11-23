export const languages = ['tr', 'en'] as const;
export type Language = typeof languages[number];
export const optionIds = ['option1', 'option2', 'option3', 'option4'] as const;
export type OptionId = typeof optionIds[number];

export type QuestionText = {
  prompt: string;
  options: Record<OptionId, string>;
  explanation: string;
};

type Original = {
  language: string;
  revision: number;
  text: QuestionText;
};

type Translation = {
  sourceRevision: number;
  status: 'draft' | 'accepted';
  text: QuestionText;
};

type ArchiveProvenance = {
  kind: 'archive';
  license: string | null;
  publication: 'approved' | 'pending' | 'restricted';
  occurrences: {
    occurrenceId: string;
    sourceRecordId: string;
    country: string;
    editionId: string;
    sourceStep: number | null;
    sourceUrl: string;
    sourceRow: string | null;
    sourceOptionOrder: OptionId[];
    sourceOptionLabels: Partial<Record<OptionId, string>>;
    evidence: 'dataset_reported' | 'official_text_verified' | 'direct_broadcast_verified';
  }[];
};

export type Question = {
  id: string;
  contentId: string;
  original: Original;
  translations: Partial<Record<Language, Translation>>;
  correctOptionId: OptionId;
  topic: 'science' | 'geography' | 'language' | 'math' | 'technology';
  provenance: { kind: 'original' } | ArchiveProvenance;
  playability: 'text-ready' | 'review-needed' | 'media-required';
};

export function questionText(question: Question, language: Language): QuestionText | undefined {
  if (question.original.language === language) return question.original.text;
  const translation = question.translations[language];
  if (translation?.status === 'accepted' && translation.sourceRevision === question.original.revision) {
    return translation.text;
  }
}

export function isBilingualAndPlayable(question: Question): boolean {
  if (question.playability !== 'text-ready' || !optionIds.includes(question.correctOptionId)) return false;
  if (question.provenance.kind === 'archive' && question.provenance.publication !== 'approved') return false;

  return languages.every(language => {
    const text = questionText(question, language);
    if (!text?.prompt.trim() || !text.explanation.trim()) return false;
    const options = optionIds.map(id => text.options[id]?.normalize('NFC').trim().toLocaleLowerCase(language));
    return options.every(Boolean) && new Set(options).size === optionIds.length;
  });
}

function originalQuestion(
  id: string,
  topic: Question['topic'],
  correctOptionId: OptionId,
  tr: QuestionText,
  en: QuestionText,
): Question {
  return {
    id: `original-${id}`,
    contentId: `prototype-${id}`,
    topic,
    correctOptionId,
    original: { language: 'tr', revision: 1, text: tr },
    translations: { en: { sourceRevision: 1, status: 'accepted', text: en } },
    provenance: { kind: 'original' },
    playability: 'text-ready',
  };
}

// Increment when question content or the prototype pool changes.
export const dataVersion = 'original-tr-en-1';

export const questions = [
  originalQuestion('penguin', 'geography', 'option2', {
    prompt: 'Afrika penguenleri Namibya kıyılarında hangi okyanusta yüzer?',
    options: { option1: 'Arktik Okyanusu', option2: 'Atlas Okyanusu', option3: 'Büyük Okyanus', option4: 'Bu tür yalnızca göllerde yüzer.' },
    explanation: 'Afrika pengueninin doğal yaşam alanı Namibya ve Güney Afrika’nın kıyılarındaki Atlas Okyanusu sularını kapsar.',
  }, {
    prompt: 'Which ocean do African penguins swim in along the coast of Namibia?',
    options: { option1: 'Arctic Ocean', option2: 'Atlantic Ocean', option3: 'Pacific Ocean', option4: 'They swim only in lakes.' },
    explanation: 'The African penguin’s natural range includes Atlantic waters along the Namibian and South African coasts.',
  }),
  originalQuestion('copper', 'science', 'option3', {
    prompt: 'Bir müzede “Cu” simgesiyle etiketlenmiş metal örneği hangisidir?',
    options: { option1: 'Kobalt', option2: 'Çinko', option3: 'Bakır', option4: 'Kalay' },
    explanation: 'Bakırın Cu simgesi, Latince cuprum adından gelir.',
  }, {
    prompt: 'Which metal specimen would a museum label with the symbol “Cu”?',
    options: { option1: 'Cobalt', option2: 'Zinc', option3: 'Copper', option4: 'Tin' },
    explanation: 'Copper gets the symbol Cu from its Latin name, cuprum.',
  }),
  originalQuestion('tile', 'math', 'option1', {
    prompt: 'Kare bir panoda 7 sıra ve her sırada 7 karo var. Dört köşe karosu çıkarılırsa kaç karo kalır?',
    options: { option1: '45', option2: '42', option3: '46', option4: '48' },
    explanation: 'Panoda 7 × 7 = 49 karo vardır. Dört köşe çıkarılınca 45 karo kalır.',
  }, {
    prompt: 'A square board has 7 rows of 7 tiles. How many tiles remain if you remove all four corner tiles?',
    options: { option1: '45', option2: '42', option3: '46', option4: '48' },
    explanation: 'The board starts with 7 × 7 = 49 tiles. Removing the four corners leaves 45.',
  }),
  originalQuestion('octopus', 'science', 'option4', {
    prompt: 'Bir ahtapotun kaç kalbi vardır?',
    options: { option1: 'Bir', option2: 'İki', option3: 'Dört', option4: 'Üç' },
    explanation: 'İki kalp solungaçlara, üçüncü kalp ise vücudun geri kalanına kan pompalar.',
  }, {
    prompt: 'How many hearts does an octopus have?',
    options: { option1: 'One', option2: 'Two', option3: 'Four', option4: 'Three' },
    explanation: 'Two hearts pump blood to the gills, and a third pumps blood to the rest of the body.',
  }),
  originalQuestion('braille', 'language', 'option2', {
    prompt: 'Standart altı noktalı Braille hücresinde noktalar nasıl dizilir?',
    options: { option1: 'Tek sırada altı nokta', option2: 'İki sütunda üçer nokta', option3: 'Halka biçiminde altı nokta', option4: 'Üç sütunda ikişer nokta' },
    explanation: 'Standart hücrenin her biri üç noktalı iki sütunu vardır. Kabartılan noktaların birleşimi karakteri oluşturur.',
  }, {
    prompt: 'How are the dots arranged in a standard six-dot Braille cell?',
    options: { option1: 'Six dots in one row', option2: 'Three dots in each of two columns', option3: 'Six dots in a ring', option4: 'Two dots in each of three columns' },
    explanation: 'The standard cell has two columns of three positions. The combination of raised dots makes the character.',
  }),
  originalQuestion('lakes', 'geography', 'option1', {
    prompt: 'Kuzey Amerika’daki beş Büyük Göl arasında yüzölçümü en geniş olan hangisidir?',
    options: { option1: 'Superior Gölü', option2: 'Ontario Gölü', option3: 'Erie Gölü', option4: 'Michigan Gölü' },
    explanation: 'Superior Gölü yüzölçümü bakımından Büyük Göller’in en genişidir.',
  }, {
    prompt: 'Which of North America’s five Great Lakes has the largest surface area?',
    options: { option1: 'Lake Superior', option2: 'Lake Ontario', option3: 'Lake Erie', option4: 'Lake Michigan' },
    explanation: 'Lake Superior has the largest surface area of the Great Lakes.',
  }),
  originalQuestion('binary', 'technology', 'option3', {
    prompt: 'İkili sayı sistemindeki 1011, onluk sistemde hangi sayıya karşılık gelir?',
    options: { option1: '9', option2: '13', option3: '11', option4: '7' },
    explanation: '1011, soldan sağa 8 + 0 + 2 + 1 anlamına gelir.',
  }, {
    prompt: 'What is the decimal value of the binary number 1011?',
    options: { option1: '9', option2: '13', option3: '11', option4: '7' },
    explanation: 'From left to right the places add up to 8 + 0 + 2 + 1.',
  }),
  originalQuestion('equator', 'geography', 'option4', {
    prompt: 'Aşağıdaki ülkelerden hangisinin ana karasından Ekvator geçer?',
    options: { option1: 'Fas', option2: 'Namibya', option3: 'Tunus', option4: 'Kenya' },
    explanation: 'Ekvator Kenya’nın ana karasından geçer. Fas ve Tunus kuzeyde, Namibya güneyde kalır.',
  }, {
    prompt: 'Which of these countries has the equator running through its mainland?',
    options: { option1: 'Morocco', option2: 'Namibia', option3: 'Tunisia', option4: 'Kenya' },
    explanation: 'The equator crosses mainland Kenya. Morocco and Tunisia are to the north, and Namibia is to the south.',
  }),
  originalQuestion('shadow', 'science', 'option2', {
    prompt: 'Bir ay tutulması sırasında Güneş ile Ay’ın arasına hangi gök cismi girer?',
    options: { option1: 'Venüs', option2: 'Dünya', option3: 'Merkür', option4: 'Mars' },
    explanation: 'Ay tutulması, Dünya Güneş ile Ay arasına girdiğinde ve gölgesi Ay’ın üzerine düştüğünde oluşur.',
  }, {
    prompt: 'Which body lies between the Sun and the Moon during a lunar eclipse?',
    options: { option1: 'Venus', option2: 'Earth', option3: 'Mercury', option4: 'Mars' },
    explanation: 'A lunar eclipse occurs when Earth passes between the Sun and the Moon, casting its shadow on the Moon.',
  }),
  originalQuestion('dice', 'math', 'option1', {
    prompt: 'Adil, altı yüzlü bir zarı bir kez attığında 4’ten büyük bir sayı gelme olasılığı nedir?',
    options: { option1: '1/3', option2: '1/2', option3: '1/6', option4: '2/3' },
    explanation: 'Altı eşit olasılıklı sonuçtan ikisi, 5 ve 6, koşulu sağlar. Olasılık 2/6, yani 1/3’tür.',
  }, {
    prompt: 'What is the probability of rolling a number greater than 4 on one roll of a fair six-sided die?',
    options: { option1: '1/3', option2: '1/2', option3: '1/6', option4: '2/3' },
    explanation: 'Two of the six equally likely results, 5 and 6, meet the condition. The probability is 2/6, or 1/3.',
  }),
];

export const pool = questions.filter(isBilingualAndPlayable);
export const questionById = new Map(pool.map(question => [question.id, question]));
