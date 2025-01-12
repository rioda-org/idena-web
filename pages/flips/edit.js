import React, {useEffect} from 'react'
import {useRouter} from 'next/router'
import {Box, Code, Flex, useToast, Divider} from '@chakra-ui/core'
import {useTranslation} from 'react-i18next'
import {useMachine} from '@xstate/react'
import {Page} from '../../screens/app/components'
import {
  FlipMaster,
  FlipMasterFooter,
  FlipPageTitle,
  FlipMasterNavbar,
  FlipMasterNavbarItem,
  FlipStoryStep,
  FlipStepBody,
  FlipKeywordTranslationSwitch,
  CommunityTranslations,
  FlipKeywordPanel,
  FlipKeyword,
  FlipKeywordName,
  FlipStoryAside,
  FlipEditorStep,
  FlipShuffleStep,
  FlipSubmitStep,
  CommunityTranslationUnavailable,
} from '../../screens/flips/components'
import Layout from '../../shared/components/layout'
import {NotificationType} from '../../shared/providers/notification-context'
import {flipMasterMachine} from '../../screens/flips/machines'
import {publishFlip, isPendingKeywordPair} from '../../screens/flips/utils'
import {Notification} from '../../shared/components/notifications'
import {Step} from '../../screens/flips/types'
import {
  IconButton2,
  SecondaryButton,
  PrimaryButton,
} from '../../shared/components/button'
import {Toast} from '../../shared/components/components'
import db from '../../shared/utils/db'
import {useEpochState} from '../../shared/providers/epoch-context'
import {useAuthState} from '../../shared/providers/auth-context'
import {redact} from '../../shared/utils/logs'

export default function EditFlipPage() {
  const {t, i18n} = useTranslation()

  const router = useRouter()

  const {id} = router.query

  const toast = useToast()

  const epochState = useEpochState()
  const {privateKey} = useAuthState()

  const [current, send] = useMachine(flipMasterMachine, {
    context: {
      locale: 'en',
    },
    services: {
      // eslint-disable-next-line no-shadow
      prepareFlip: async ({id, wordPairs}) => {
        const persistedFlips = await db.table('ownFlips').toArray()

        const {
          // eslint-disable-next-line no-shadow
          images,
          keywordPairId = 0,
          ...flip
        } = persistedFlips.find(({id: flipId}) => flipId === id)

        // eslint-disable-next-line no-shadow
        const availableKeywords = Array.isArray(wordPairs)
          ? wordPairs.filter(
              pair =>
                !pair.used && !isPendingKeywordPair(persistedFlips, pair.id)
            )
          : [{id: 0, words: flip.keywords.words.map(w => w.id)}]

        return {...flip, images, keywordPairId, availableKeywords}
      },
      submitFlip: async context => publishFlip(context),
    },
    actions: {
      onSubmitted: () => router.push('/flips/list'),
      onError: (
        _,
        {data, error = data.response?.data?.error ?? data.message}
      ) =>
        toast({
          title: error,
          status: 'error',
          duration: 5000,
          isClosable: true,
          // eslint-disable-next-line react/display-name
          render: () => (
            <Box fontSize="md">
              <Notification
                title={error}
                type={NotificationType.Error}
                delay={5000}
              />
            </Box>
          ),
        }),
    },
    logger: msg => console.log(redact(msg)),
  })

  useEffect(() => {
    if (id && epochState && privateKey) {
      send('PREPARE_FLIP', {id, epoch: epochState.epoch, privateKey})
    }
  }, [epochState, id, privateKey, send])

  const {
    availableKeywords,
    keywords,
    images,
    originalOrder,
    order,
    showTranslation,
    isCommunityTranslationsExpanded,
  } = current.context

  const not = state => !current?.matches({editing: state})
  const is = state => current?.matches({editing: state})

  const isOffline = is('keywords.loaded.fetchTranslationsFailed')

  return (
    <Layout>
      <Page p={0}>
        <Flex
          direction="column"
          flex={1}
          alignSelf="stretch"
          px={20}
          pb="36px"
          overflowY="auto"
        >
          <FlipPageTitle
            onClose={() => {
              if (images.some(x => x))
                toast({
                  status: 'success',
                  // eslint-disable-next-line react/display-name
                  render: () => (
                    <Toast title={t('Flip has been saved to drafts')} />
                  ),
                })
              router.push('/flips/list')
            }}
          >
            {t('Edit flip')}
          </FlipPageTitle>
          {current.matches('editing') && (
            <FlipMaster>
              <FlipMasterNavbar>
                <FlipMasterNavbarItem
                  step={is('keywords') ? Step.Active : Step.Completed}
                >
                  {t('Think up a story')}
                </FlipMasterNavbarItem>
                <FlipMasterNavbarItem
                  step={
                    // eslint-disable-next-line no-nested-ternary
                    is('images')
                      ? Step.Active
                      : is('keywords')
                      ? Step.Next
                      : Step.Completed
                  }
                >
                  {t('Select images')}
                </FlipMasterNavbarItem>
                <FlipMasterNavbarItem
                  step={
                    // eslint-disable-next-line no-nested-ternary
                    is('shuffle')
                      ? Step.Active
                      : not('submit')
                      ? Step.Next
                      : Step.Completed
                  }
                >
                  {t('Shuffle images')}
                </FlipMasterNavbarItem>
                <FlipMasterNavbarItem
                  step={is('submit') ? Step.Active : Step.Next}
                >
                  {t('Submit flip')}
                </FlipMasterNavbarItem>
              </FlipMasterNavbar>
              {is('keywords') && (
                <FlipStoryStep>
                  <FlipStepBody minH="180px">
                    <Box>
                      <FlipKeywordPanel>
                        {is('keywords.loaded') && (
                          <>
                            <FlipKeywordTranslationSwitch
                              keywords={keywords}
                              showTranslation={showTranslation}
                              locale={i18n.language}
                              onSwitchLocale={() => send('SWITCH_LOCALE')}
                            />
                            {(i18n.language || 'en').toUpperCase() !== 'EN' &&
                              !isOffline && (
                                <>
                                  <Divider
                                    borderColor="gray.300"
                                    mx={-10}
                                    mt={4}
                                    mb={6}
                                  />
                                  <CommunityTranslations
                                    keywords={keywords}
                                    onVote={e => send('VOTE', e)}
                                    onSuggest={e => send('SUGGEST', e)}
                                    isOpen={isCommunityTranslationsExpanded}
                                    onToggle={() =>
                                      send('TOGGLE_COMMUNITY_TRANSLATIONS')
                                    }
                                  />
                                </>
                              )}
                          </>
                        )}
                        {is('keywords.failure') && (
                          <FlipKeyword>
                            <FlipKeywordName>
                              {t('Missing keywords')}
                            </FlipKeywordName>
                          </FlipKeyword>
                        )}
                      </FlipKeywordPanel>
                      {isOffline && <CommunityTranslationUnavailable />}
                    </Box>
                    <FlipStoryAside>
                      <IconButton2
                        icon="refresh"
                        isDisabled={availableKeywords.length === 0}
                        onClick={() => send('CHANGE_KEYWORDS')}
                      >
                        {t('Change words')}
                      </IconButton2>
                    </FlipStoryAside>
                  </FlipStepBody>
                </FlipStoryStep>
              )}
              {is('images') && (
                <FlipEditorStep
                  keywords={keywords}
                  showTranslation={showTranslation}
                  originalOrder={originalOrder}
                  images={images}
                  onChangeImage={(image, currentIndex) =>
                    send('CHANGE_IMAGES', {image, currentIndex})
                  }
                  // eslint-disable-next-line no-shadow
                  onChangeOriginalOrder={order =>
                    send('CHANGE_ORIGINAL_ORDER', {order})
                  }
                  onPainting={() => send('PAINTING')}
                />
              )}
              {is('shuffle') && (
                <FlipShuffleStep
                  images={images}
                  originalOrder={originalOrder}
                  order={order}
                  onShuffle={() => send('SHUFFLE')}
                  onManualShuffle={nextOrder =>
                    send('MANUAL_SHUFFLE', {order: nextOrder})
                  }
                  onReset={() => send('RESET_SHUFFLE')}
                />
              )}
              {is('submit') && (
                <FlipSubmitStep
                  keywords={keywords}
                  showTranslation={showTranslation}
                  locale={i18n.language}
                  onSwitchLocale={() => send('SWITCH_LOCALE')}
                  originalOrder={originalOrder}
                  order={order}
                  images={images}
                />
              )}
            </FlipMaster>
          )}
        </Flex>
        <FlipMasterFooter>
          {not('keywords') && (
            <SecondaryButton
              isDisabled={is('images.painting')}
              onClick={() => send('PREV')}
            >
              {t('Previous step')}
            </SecondaryButton>
          )}
          {not('submit') && (
            <PrimaryButton
              isDisabled={is('images.painting')}
              onClick={() => send('NEXT')}
            >
              {t('Next step')}
            </PrimaryButton>
          )}
          {is('submit') && (
            <PrimaryButton
              isDisabled={is('submit.submitting')}
              isLoading={is('submit.submitting')}
              loadingText={t('Publishing')}
              onClick={() => send('SUBMIT')}
            >
              {t('Submit')}
            </PrimaryButton>
          )}
        </FlipMasterFooter>
      </Page>
    </Layout>
  )
}
