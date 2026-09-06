import { strict as assert } from 'node:assert';
import {
  isCanonicalBroadIpa,
  isStandardBroadIpa,
  normalizeBroadIpa,
} from '../src/modules/dictionary/dictionary-ipa.util';

const normalizations: Array<[string, string | null]> = [
  ['/\u02c8ɔː.təʊˌmeɪ.kə/', '/\u02c8ɔː.təʊˌmeɪ.kə/'],
  ['/\u02c8ɑː.t\u032coʊˌmeɪ.kər/', '/\u02c8ɑː.toʊˌmeɪ.kər/'],
  ['/ɔː\u02c8tɒm.ə.tə/', '/ɔː\u02c8tɒm.ə.tə/'],
  ['/\u02c8flæt.kɑː/', '/\u02c8flæt.kɑː/'],
  ['/\u02c8flætˌkɑːr/', '/\u02c8flætˌkɑːr/'],
  ['/\u02c8ɑː.\u02cctoʊ..meɪ/', '/\u02c8ɑːˌtoʊ.meɪ/'],
  ['/hɛə/', '/heə/'],
  ['/\u02c8ɛə.pɔːt/', '/\u02c8eə.pɔːt/'],
  ['/bɛd/', '/bed/'],
  ['ɛr kən\u02ccdɪʃənɪŋ', '/er kən\u02ccdɪʃənɪŋ/'],
  ['ɛr.pɔrt', '/er.pɔrt/'],
  ['/\u02ccɔ.ʈɵˌme.ʈɑ/', '/\u02ccɔ.təˌme.tɑ/'],
];

for (const [input, expected] of normalizations) {
  assert.equal(normalizeBroadIpa(input), expected, input);
}

assert.equal(isStandardBroadIpa('/\u02c8ɑː.toʊˌmeɪ.kər/'), true);
assert.equal(isCanonicalBroadIpa('/\u02c8ɑː.toʊˌmeɪ.kər/'), true);
assert.equal(isCanonicalBroadIpa('/\u02c8ɑː.t\u032coʊˌmeɪ.kər/'), false);
assert.equal(isStandardBroadIpa('/\u02ccɔ.ʈɵˌme.ʈɑ/'), true);

console.log('dictionary IPA normalization tests passed');
