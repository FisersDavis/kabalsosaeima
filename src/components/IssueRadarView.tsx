import React from 'react';
import {
  TematiskaisRadarsView,
  type TematiskaisRadarsViewProps,
  CIVIC_DOMAINS,
  INSTITUTIONAL_ORDER,
  getFrictionBadge,
  type CivicDomainConfig,
  type FrictionBadgeInfo,
} from './radars/TematiskaisRadarsView';

export type IssueRadarViewProps = TematiskaisRadarsViewProps;

export const IssueRadarView: React.FC<IssueRadarViewProps> = (props) => {
  return <TematiskaisRadarsView {...props} />;
};

export {
  TematiskaisRadarsView,
  CIVIC_DOMAINS,
  INSTITUTIONAL_ORDER,
  getFrictionBadge,
  type CivicDomainConfig,
  type FrictionBadgeInfo,
};

export default IssueRadarView;
