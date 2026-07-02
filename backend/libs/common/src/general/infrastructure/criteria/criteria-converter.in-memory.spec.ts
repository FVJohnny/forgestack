import { InMemoryCriteriaConverter } from './criteria-converter.in-memory';
import {
  testCriteriaConverterContract,
  type TestEntityDTO,
} from '../../domain/criteria/criteria-converter.contract';

describe('InMemoryCriteriaConverter', () => {
  testCriteriaConverterContract(
    'InMemory Implementation',
    async (entities: TestEntityDTO[]) => new InMemoryCriteriaConverter<TestEntityDTO>(entities),
  );
});
