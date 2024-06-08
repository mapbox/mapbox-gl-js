import type {Expression} from '../expression/expression';

export type ConfigOptionValue = {
  default: Expression;
  value?: Expression;
  values?: Array<unknown>;
  minValue?: number;
  maxValue?: number;
  stepValue?: number;
  type?: 'string' | 'number' | 'boolean' | 'color';
};

export type ConfigOptions = Map<string, ConfigOptionValue>;
