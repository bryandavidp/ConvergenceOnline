import { StyleSheet, Dimensions } from 'react-native';
import { colors, spacing, fontSizes, borderRadius } from '../../../../utils/theme';

const { width } = Dimensions.get('window');

export const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  header: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSizes.xxl,
    fontWeight: 'bold',
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },
  scoreContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  scoreText: {
    fontSize: fontSizes.lg,
    fontWeight: 'bold',
    color: colors.textLight,
  },
  levelContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  levelLabel: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  levelText: {
    fontSize: fontSizes.lg,
    fontWeight: 'bold',
    color: colors.textLight,
  },
  fpsCounter: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  gameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  controls: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
    flexWrap: 'wrap',
  },
  button: {
    backgroundColor: colors.primaryButton,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.sm,
    marginVertical: spacing.sm,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: colors.textLight,
    fontWeight: 'bold',
    fontSize: fontSizes.md,
  },
  secondaryButton: {
    backgroundColor: colors.secondaryButton,
  },
  disabledButton: {
    backgroundColor: colors.disabledButton,
    opacity: 0.7,
  },
  disabledButtonText: {
    opacity: 0.7,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondaryButton,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.sm,
  },
  hintButtonText: {
    color: colors.textLight,
    fontWeight: '600',
    fontSize: fontSizes.sm,
  },
  hintCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  hintCountText: {
    color: colors.textLight,
    fontSize: fontSizes.xs,
    fontWeight: 'bold',
  },
  toggleButton: {
    backgroundColor: 'rgba(51, 65, 85, 0.8)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: spacing.md,
    alignSelf: 'center',
  },
  toggleButtonText: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
  },
  timerContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 100,
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  timerText: {
    fontSize: fontSizes.lg,
    fontWeight: 'bold',
    color: colors.textLight,
  },
  timerWarning: {
    color: colors.warning,
  },
  timerDanger: {
    color: colors.danger,
  },
  settingsPanel: {
    maxHeight: 300,
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  settingsPanelContent: {
    padding: spacing.md,
  },
  settingsHeader: {
    color: colors.textLight,
    fontSize: fontSizes.lg,
    fontWeight: 'bold',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  settingsSubHeader: {
    color: colors.textLight,
    fontSize: fontSizes.md,
    fontWeight: '600',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
}); 